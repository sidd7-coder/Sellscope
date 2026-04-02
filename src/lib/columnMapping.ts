export type CanonicalField = "product" | "date" | "quantity" | "sales";

export const canonicalFieldLabels: Record<CanonicalField, string> = {
  product: "Product",
  date: "Date",
  quantity: "Quantity",
  sales: "Sales",
};

const synonyms: Record<CanonicalField, string[]> = {
  product: ["product", "product_name", "product_id", "item", "item_name"],
  date: ["date", "order_date", "transaction_date", "timestamp", "sale_date"],
  quantity: ["quantity", "qty", "units", "volume"],
  sales: ["sales", "revenue", "total", "amount", "sales_amount"],
};

function normalizeHeader(raw: string): string {
  // Case-insensitive and whitespace/punctuation tolerant.
  // Example: "Product Name" -> "product_name"
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s\-_.]+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function normalizeHeaderForDetect(raw: string): string {
  return normalizeHeader(String(raw ?? ""));
}

export type DetectedMapping = Partial<Record<CanonicalField, string>>;

export function autoDetectMapping(headers: string[]): {
  detected: DetectedMapping;
  missing: CanonicalField[];
} {
  const detected: DetectedMapping = {};
  const missing: CanonicalField[] = ["product", "date", "quantity", "sales"];

  // Pre-normalize synonyms for fast comparisons.
  const synNorm: Record<CanonicalField, string[]> = {
    product: synonyms.product.map(normalizeHeader),
    date: synonyms.date.map(normalizeHeader),
    quantity: synonyms.quantity.map(normalizeHeader),
    sales: synonyms.sales.map(normalizeHeader),
  };

  for (const field of missing.slice()) {
    const wanted = new Set(synNorm[field]);
    const idx = headers.findIndex((h) => wanted.has(normalizeHeader(h)));
    if (idx !== -1) {
      detected[field] = headers[idx];
      const i = missing.indexOf(field);
      if (i !== -1) missing.splice(i, 1);
    }
  }

  return { detected, missing };
}

export type HeaderIndexMapping = Record<CanonicalField, number>;

export function resolveHeaderIndices(
  headers: string[],
  mapping: DetectedMapping
): HeaderIndexMapping {
  const idx: Partial<Record<CanonicalField, number>> = {};
  const normalizedHeaders = headers.map((h) => normalizeHeaderForDetect(h));

  const findIndexForHeaderValue = (headerValue: string) => {
    const n = normalizeHeaderForDetect(headerValue);
    return normalizedHeaders.findIndex((h) => h === n);
  };

  (["product", "date", "quantity", "sales"] as CanonicalField[]).forEach((f) => {
    const headerValue = mapping[f];
    if (!headerValue) return;
    const found = findIndexForHeaderValue(headerValue);
    if (found !== -1) idx[f] = found;
  });

  // If a field was missing, throw so API can return a clear error.
  (["product", "date", "quantity", "sales"] as CanonicalField[]).forEach((f) => {
    if (idx[f] == null) {
      throw new Error(`Missing required column mapping for "${f}".`);
    }
  });

  return idx as HeaderIndexMapping;
}

export function normalizeHeaderValue(
  headerValue: string
): CanonicalField | null {
  // Not currently used for UI; kept small for future improvements.
  const n = normalizeHeaderForDetect(headerValue);
  const entries = Object.entries(synonyms) as [CanonicalField, string[]][];
  for (const [field, syn] of entries) {
    const wanted = new Set(syn.map(normalizeHeader));
    if (wanted.has(n)) return field;
  }
  return null;
}

