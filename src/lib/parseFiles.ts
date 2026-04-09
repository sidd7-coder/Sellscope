"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { cleanSalesRows, rowFromRecord } from "./clean";
import { autoDetectMapping, resolveHeaderIndices } from "./columnMapping";
import type { SalesRow } from "./types";

function tableToSalesRows(table: unknown[][]): SalesRow[] {
  if (!Array.isArray(table) || table.length < 2) return [];

  const headers = (table[0] ?? []).map((x) => String(x ?? "").trim());
  const dataRows = (table.slice(1) ?? []).map((r) => r ?? []);
  const { detected, missing } = autoDetectMapping(headers);

  if (missing.length > 0) {
    throw new Error(`Missing required columns: ${missing.join(", ")}`);
  }

  const indices = resolveHeaderIndices(headers, detected);
  const partials: Partial<SalesRow>[] = [];

  for (const row of dataRows) {
    const r = row as unknown[];
    if (!r || r.length === 0) continue;
    partials.push({
      product: (r[indices.product] ?? "") as string,
      date: r[indices.date] as any,
      quantity: r[indices.quantity] as any,
      sales: r[indices.sales] as any,
    });
  }

  return cleanSalesRows(partials);
}

export function parseCsvFile(file: File): Promise<SalesRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      delimiter: "",
      complete: (res) => {
        try {
          const rows = tableToSalesRows(res.data as unknown[][]);
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

export function parseExcelFile(file: File): Promise<SalesRow[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const table = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: "",
      raw: true,
    }) as unknown[][];
    return tableToSalesRows(table);
  });
}

export function parseJsonFile(file: File): Promise<SalesRow[]> {
  return file.text().then((text) => {
    const raw = JSON.parse(text) as unknown;
    if (!Array.isArray(raw)) return [];
    const rows: SalesRow[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const parsed = rowFromRecord(item as Record<string, unknown>);
      if (parsed && parsed.product && parsed.date && parsed.quantity != null && parsed.sales != null) {
        rows.push(parsed as SalesRow);
      }
    }
    return rows;
  });
}
