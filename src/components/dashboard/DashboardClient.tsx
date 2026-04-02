"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import type { ForecastResponse, SalesRow } from "@/lib/types";
import { cleanSalesRows } from "@/lib/clean";
import { parseCsvFile, parseExcelFile } from "@/lib/parseFiles";
import { Card } from "@/components/ui/Card";

const manualSchema = z.object({
  product: z.string().min(1, "Product is required"),
  date: z.string().min(1, "Date is required"),
  quantity: z.coerce.number().nonnegative("Quantity must be 0 or more"),
  sales: z.coerce.number().nonnegative("Sales must be 0 or more"),
});

export function DashboardClient() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [product, setProduct] = useState("");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sales, setSales] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");

  const previewRows = useMemo(() => rows.slice(0, 200), [rows]);

  // ✅ Download CSV
  const downloadCSV = () => {
    if (!rows || rows.length === 0) return;

    const csv = [
      "product,date,quantity,sales",
      ...rows.map((r) =>
        [r.product, r.date, r.quantity, r.sales].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "sales_data.csv";
    a.click();

    URL.revokeObjectURL(url);
  };

  function addManual(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const parsed = manualSchema.safeParse({
      product,
      date,
      quantity,
      sales,
    });

    if (!parsed.success) {
      const msg = parsed.error.errors.map((x) => x.message).join(" ");
      setFormError(msg);
      return;
    }

    const row: SalesRow = {
      product: parsed.data.product.trim(),
      date: parsed.data.date,
      quantity: parsed.data.quantity,
      sales: parsed.data.sales,
    };

    const cleaned = cleanSalesRows([row]);

    if (cleaned.length === 0) {
      setFormError("Invalid date.");
      return;
    }

    setRows((prev) => cleanSalesRows([...prev, ...cleaned]));
    setProduct("");
    setDate("");
    setQuantity("");
    setSales("");
  }

  async function onCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setFileError(null);

    try {
      const parsed = await parseCsvFile(f);
      setRows((prev) => cleanSalesRows([...prev, ...parsed]));
    } catch {
      setFileError("Could not read CSV.");
    }
  }

  async function onExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setFileError(null);

    try {
      const parsed = await parseExcelFile(f);
      setRows((prev) => cleanSalesRows([...prev, ...parsed]));
    } catch {
      setFileError("Could not read Excel.");
    }
  }

  function clearData() {
    setRows([]);
    setResult(null);
  }

  async function runForecast() {
    setForecastError(null);
    if (rows.length === 0) return;

    setLoading(true);

    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, period }),
      });

      const data = await res.json();
      setResult(data);
    } catch {
      setForecastError("Error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <Card>
        {/* ✅ FIXED HEADER */}
        <h3 className="text-lg font-semibold flex justify-between items-center mb-3">
          Dataset preview

          <button
            onClick={downloadCSV}
            disabled={rows.length === 0}
            className="px-3 py-1 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            Download CSV
          </button>
        </h3>

        <div className="text-xs mb-2">{rows.length} rows</div>

        <table className="w-full text-xs">
          <thead>
            <tr>
              <th>Product</th>
              <th>Date</th>
              <th>Qty</th>
              <th>Sales</th>
            </tr>
          </thead>

          <tbody>
            {previewRows.map((r, i) => (
              <tr key={i}>
                <td>{r.product}</td>
                <td>{r.date}</td>
                <td>{r.quantity}</td>
                <td>{r.sales}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}