import { NextResponse } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cleanSalesRows } from "@/lib/clean";
import {
  autoDetectMapping,
  resolveHeaderIndices,
  type CanonicalField,
  type DetectedMapping,
} from "@/lib/columnMapping";
import type { SalesRow } from "@/lib/types";

export const runtime = "nodejs";

const ingestSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1),
  autoDetect: z.boolean().optional().default(true),
  // Mapping values must be column header strings from the uploaded file.
  mapping: z
    .object({
      product: z.string().optional(),
      date: z.string().optional(),
      quantity: z.string().optional(),
      sales: z.string().optional(),
    })
    .optional(),
  period: z.enum(["weekly", "monthly"]).optional().default("weekly"),
});

function isExcelFile(fileName: string, mimeType: string) {
  const fn = fileName.toLowerCase();
  return (
    fn.endsWith(".xlsx") ||
    fn.endsWith(".xls") ||
    mimeType.includes("spreadsheetml")
  );
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = ingestSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { status: "error", error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fileName, mimeType, base64, autoDetect, mapping } = parsed.data;
    const buf = Buffer.from(base64, "base64");

    const excel = isExcelFile(fileName, mimeType);
    let headers: string[] = [];
    let dataRows: unknown[][] = [];

    if (!excel) {
      const csvText = buf.toString("utf8");
      const parsedCsv = Papa.parse<string[]>(csvText, {
        header: false,
        skipEmptyLines: true,
      });
      const table = parsedCsv.data as unknown[][];
      if (!Array.isArray(table) || table.length < 2) {
        return NextResponse.json(
          { status: "error", error: "CSV must have a header row plus data rows." },
          { status: 400 }
        );
      }
      headers = (table[0] ?? []).map((x) => String(x ?? "").trim());
      dataRows = (table.slice(1) ?? []).map((r) => r ?? []);
    } else {
      const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      if (!sheet) {
        return NextResponse.json(
          { status: "error", error: "Could not read the first Excel sheet." },
          { status: 400 }
        );
      }
      const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        defval: "",
      }) as unknown[][];
      if (!Array.isArray(table) || table.length < 2) {
        return NextResponse.json(
          { status: "error", error: "Excel must have a header row plus data rows." },
          { status: 400 }
        );
      }
      headers = (table[0] ?? []).map((x) => String(x ?? "").trim());
      dataRows = (table.slice(1) ?? []).map((r) => r ?? []);
    }

    if (headers.length === 0) {
      return NextResponse.json(
        { status: "error", error: "No headers detected in the uploaded file." },
        { status: 400 }
      );
    }

    const { detected, missing } = autoDetectMapping(headers);

    const finalMapping: DetectedMapping | undefined = mapping
      ? mapping
      : detected;

    if ((!mapping || autoDetect) && missing.length > 0 && !finalMapping) {
      return NextResponse.json(
        {
          status: "needs_mapping",
          headers,
          detected,
          missing,
        },
        { status: 200 }
      );
    }

    // If auto-detection failed and the client did not provide mapping, ask for mapping.
    if (mapping == null && missing.length > 0) {
      return NextResponse.json(
        { status: "needs_mapping", headers, detected, missing },
        { status: 200 }
      );
    }

    if (!finalMapping) {
      return NextResponse.json(
        { status: "error", error: "Could not determine required column mapping." },
        { status: 400 }
      );
    }

    // Validate mapping contains required fields.
    for (const field of ["product", "date", "quantity", "sales"] as CanonicalField[]) {
      if (!finalMapping[field]) {
        return NextResponse.json(
          {
            status: "error",
            error: `Missing required mapping for "${field}".`,
          },
          { status: 400 }
        );
      }
    }

    let indices: ReturnType<typeof resolveHeaderIndices>;
    try {
      indices = resolveHeaderIndices(headers, finalMapping);
    } catch (e) {
      return NextResponse.json(
        { status: "error", error: "Mapping could not be resolved to column indices." },
        { status: 400 }
      );
    }

    const maxRows = 20000;
    const partials: Partial<SalesRow>[] = [];
    for (let i = 0; i < dataRows.length && partials.length < maxRows; i++) {
      const row = dataRows[i] as unknown[] | undefined;
      if (!row || row.length === 0) continue;

      const productVal = row[indices.product];
      const dateVal = row[indices.date];
      const quantityVal = row[indices.quantity];
      const salesVal = row[indices.sales];

      // Skip rows that are effectively empty.
      if (
        (productVal == null || String(productVal).trim() === "") &&
        (dateVal == null || String(dateVal).trim() === "") &&
        (quantityVal == null || String(quantityVal).trim() === "") &&
        (salesVal == null || String(salesVal).trim() === "")
      ) {
        continue;
      }

      partials.push({
      product: String(productVal),
      date: String(dateVal),
      quantity: Number(quantityVal),
    sales: Number(salesVal),
});
    }

    const rows = cleanSalesRows(partials);

    return NextResponse.json({
      status: "ok",
      rows,
      headers,
      detected,
      usedMapping: finalMapping,
    });
  } catch {
    return NextResponse.json(
      { status: "error", error: "Could not process the uploaded file." },
      { status: 500 }
    );
  }
}

