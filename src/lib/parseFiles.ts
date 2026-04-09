"use client";

import Papa from "papaparse";
import * as XLSX from "xlsx";
import { rowFromRecord } from "./clean";
import type { SalesRow } from "./types";

export function parseCsvFile(file: File): Promise<SalesRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rows: SalesRow[] = [];
        for (const r of res.data as Record<string, unknown>[]) {
          const parsed = rowFromRecord(r);
          if (parsed && parsed.product && parsed.date && parsed.quantity != null && parsed.sales != null) {
            rows.push(parsed as SalesRow);
          }
        }
        resolve(rows);
      },
      error: (err) => reject(err),
    });
  });
}

export function parseExcelFile(file: File): Promise<SalesRow[]> {
  return file.arrayBuffer().then((buf) => {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      raw: false,
    });
    const rows: SalesRow[] = [];
    for (const r of json) {
      const parsed = rowFromRecord(r);
      if (parsed && parsed.product && parsed.date && parsed.quantity != null && parsed.sales != null) {
        rows.push(parsed as SalesRow);
      }
    }
    return rows;
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
