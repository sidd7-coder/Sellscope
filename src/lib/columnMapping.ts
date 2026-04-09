export type CanonicalField = "product" | "date" | "quantity" | "sales";

export const canonicalFieldLabels: Record<CanonicalField, string> = {
  product: "Product",
  date: "Date",
  quantity: "Quantity",
  sales: "Sales",
};

const synonyms: Record<CanonicalField, string[]> = {
  product: ["product", "item", "name", "product_name"],
  date: ["date", "day", "timestamp", "time"],
  quantity: ["quantity", "qty", "qnt", "count", "units"],
  sales: ["sales", "sale", "revenue", "amount", "s"],
};

function normalizeHeader(raw: string): string {
  // Case-insensitive and whitespace tolerant.
  // Example: "Product Name" -> "productname"
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  const fields: CanonicalField[] = ["product", "date", "quantity", "sales"];
  const missing: CanonicalField[] = [...fields];

  // Pre-normalize synonyms for fast comparisons.
  const synNorm: Record<CanonicalField, string[]> = {
    product: synonyms.product.map(normalizeHeader),
    date: synonyms.date.map(normalizeHeader),
    quantity: synonyms.quantity.map(normalizeHeader),
    sales: synonyms.sales.map(normalizeHeader),
  };

  const normalizedHeaders = headers.map((h) => normalizeHeader(h));
  const usedHeaderIndices = new Set<number>();

  const scoreFor = (field: CanonicalField, headerNorm: string): number => {
    if (!headerNorm) return -1;
    const candidates = synNorm[field];
    if (candidates.includes(headerNorm)) return 100;
    if (candidates.some((c) => headerNorm.includes(c) || c.includes(headerNorm))) return 70;
    if (
      field === "quantity" &&
      (headerNorm.includes("qty") || headerNorm.includes("unit") || headerNorm.includes("sold"))
    ) {
      return 60;
    }
    if (field === "sales" && (headerNorm.includes("rev") || headerNorm.includes("amount"))) {
      return 60;
    }
    if (field === "date" && (headerNorm.includes("date") || headerNorm.includes("time"))) {
      return 60;
    }
    if (field === "product" && (headerNorm.includes("item") || headerNorm.includes("product"))) {
      return 60;
    }
    return -1;
  };

  for (const field of fields) {
    let bestIdx = -1;
    let bestScore = -1;
    for (let i = 0; i < normalizedHeaders.length; i++) {
      if (usedHeaderIndices.has(i)) continue;
      const score = scoreFor(field, normalizedHeaders[i]);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    if (bestIdx !== -1 && bestScore >= 60) {
      detected[field] = headers[bestIdx];
      usedHeaderIndices.add(bestIdx);
      const mIdx = missing.indexOf(field);
      if (mIdx !== -1) missing.splice(mIdx, 1);
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

