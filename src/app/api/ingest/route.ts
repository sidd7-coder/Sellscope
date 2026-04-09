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

function isJsonFile(fileName: string, mimeType: string) {
  const fn = fileName.toLowerCase();
  return fn.endsWith(".json") || mimeType.includes("json");
}

function parseDelimitedText(text: string): unknown[][] {
  const parsed = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
    delimiter: "",
  });
  return (parsed.data as unknown[][]) ?? [];
}

function parseJsonTable(text: string): unknown[][] {
  const raw = JSON.parse(text) as unknown;
  if (!Array.isArray(raw) || raw.length === 0) return [];

  if (Array.isArray(raw[0])) {
    return raw as unknown[][];
  }

  if (typeof raw[0] === "object" && raw[0] !== null) {
    const records = raw as Record<string, unknown>[];
    const keys = Array.from(
      new Set(records.flatMap((r) => Object.keys(r ?? {})))
    );
    if (!keys.length) return [];
    const rows = records.map((r) => keys.map((k) => r?.[k] ?? ""));
    return [keys, ...rows];
  }

  return [];
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
    const jsonFile = isJsonFile(fileName, mimeType);
    let headers: string[] = [];
    let dataRows: unknown[][] = [];

    if (!excel && !jsonFile) {
      const textTable = parseDelimitedText(buf.toString("utf8"));
      if (!Array.isArray(textTable) || textTable.length < 2) {
        return NextResponse.json(
          { status: "error", error: "File must have a header row plus data rows." },
          { status: 400 }
        );
      }
      headers = (textTable[0] ?? []).map((x) => String(x ?? "").trim());
      dataRows = (textTable.slice(1) ?? []).map((r) => r ?? []);
    } else if (jsonFile) {
      const table = parseJsonTable(buf.toString("utf8"));
      if (!Array.isArray(table) || table.length < 2) {
        return NextResponse.json(
          { status: "error", error: "JSON must contain structured rows with headers." },
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

    const { detected, missing } = autoDetectMapping(headers);

    const finalMapping: DetectedMapping | undefined = mapping ? mapping : detected;

    if (mapping == null && missing.length > 0) {
      return NextResponse.json({
        status: "needs_mapping",
        headers,
        detected,
        missing,
      });
    }

    if (!finalMapping) {
      return NextResponse.json(
        { status: "error", error: "Could not determine required column mapping." },
        { status: 400 }
      );
    }

    const indices = resolveHeaderIndices(headers, finalMapping);

    const maxRows = 20000;
    const partials: Partial<SalesRow>[] = [];

    for (let i = 0; i < dataRows.length && partials.length < maxRows; i++) {
      const row = dataRows[i] as unknown[] | undefined;
      if (!row || row.length === 0) continue;

      const productVal = row[indices.product];
      const dateVal = row[indices.date];
      const quantityVal = row[indices.quantity];
      const salesVal = row[indices.sales];

      if (
        (productVal == null || String(productVal).trim() === "") &&
        (dateVal == null || String(dateVal).trim() === "") &&
        (quantityVal == null || String(quantityVal).trim() === "") &&
        (salesVal == null || String(salesVal).trim() === "")
      ) {
        continue;
      }

      partials.push({
        product: String(productVal ?? ""),
        date: dateVal as string,
        quantity: quantityVal as number,
        sales: salesVal as number,
      });
    }

    const rows = cleanSalesRows(partials);
    if (rows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          error:
            "The uploaded file could not be mapped into usable product/date/quantity/sales rows.",
        },
        { status: 400 }
      );
    }

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