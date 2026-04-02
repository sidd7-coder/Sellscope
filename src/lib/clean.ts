import type { SalesRow } from "./types";

function parseDate(raw: string | Date | number | undefined | null): string | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) return null;
    return raw.toISOString().slice(0, 10);
  }
  if (typeof raw === "number" && raw > 20000 && raw < 100000) {
    const ms = (raw - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(raw).trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/,/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normKey(k: string): string {
  return k
    .trim()
    .toLowerCase()
    .replace(/[\s\-_\.]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Map CSV/Excel column names to canonical fields */
export function rowFromRecord(rec: Record<string, unknown>): Partial<SalesRow> | null {
  const flat: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rec)) {
    flat[normKey(k)] = v;
  }
  const product =
    (flat["product"] ??
      flat["product_name"] ??
      flat["product_id"] ??
      flat["item"] ??
      flat["item_name"] ??
      flat["name"] ??
      flat["sku"]) as string | undefined;
  const dateRaw =
    flat["date"] ??
    flat["order_date"] ??
    flat["transaction_date"] ??
    flat["timestamp"] ??
    flat["sale_date"] ??
    flat["day"];
  const quantity = toNum(
    flat["quantity"] ??
      flat["qty"] ??
      flat["units"] ??
      flat["volume"] ??
      flat["sold"]
  );
  const sales = toNum(
    flat["sales"] ??
      flat["revenue"] ??
      flat["sales_amount"] ??
      flat["amount"] ??
      flat["total"]
  );

  const date = parseDate(dateRaw as string | Date);
  const p = product != null ? String(product).trim() : "";

  if (!p || !date || quantity == null || sales == null) return null;
  if (quantity < 0 || sales < 0) return null;

  return { product: p, date, quantity, sales };
}

export function cleanSalesRows(rows: Partial<SalesRow>[]): SalesRow[] {
  const out: SalesRow[] = [];
  for (const r of rows) {
    const product = r.product != null ? String(r.product).trim() : "";
    const date = parseDate(r.date as any);
    const quantity = toNum(r.quantity);
    const sales = toNum(r.sales);
    if (!product || !date || quantity == null || sales == null) continue;
    if (quantity < 0 || sales < 0) continue;
    out.push({ product, date, quantity, sales });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
