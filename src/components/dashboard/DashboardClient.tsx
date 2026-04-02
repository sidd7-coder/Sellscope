"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import type { ForecastResponse, SalesRow } from "@/lib/types";
import { cleanSalesRows } from "@/lib/clean";
import { parseCsvFile, parseExcelFile } from "@/lib/parseFiles";
import { Card } from "@/components/ui/Card";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { ForecastVsActualChart } from "@/components/charts/ForecastVsActualChart";
import { ProductDemandBarChart } from "@/components/charts/ProductDemandBarChart";
import { FutureDemandChart } from "@/components/charts/FutureDemandChart";

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
      setFormError("Invalid date. Use a valid calendar date.");
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
      if (parsed.length === 0) {
        setFileError(
          "No valid rows. Expected columns: product, date, quantity, sales (or similar names)."
        );
        return;
      }
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
      if (parsed.length === 0) {
        setFileError(
          "No valid rows. Expected columns: product, date, quantity, sales."
        );
        return;
      }
      setRows((prev) => cleanSalesRows([...prev, ...parsed]));
    } catch {
      setFileError("Could not read Excel file.");
    }
  }

  function clearData() {
    setRows([]);
    setResult(null);
    setForecastError(null);
  }

  async function runForecast() {
    setForecastError(null);
    if (rows.length === 0) {
      setForecastError("Add at least one row before running forecast.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, period }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForecastError(data.error ?? "Forecast failed.");
        setResult(null);
        return;
      }
      setResult(data as ForecastResponse);
    } catch {
      setForecastError("Network error. Try again.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const topProducts = result?.productDemand.slice(0, 5) ?? [];
  const lowProducts =
    result?.productDemand.slice().sort((a, b) => a.quantity - b.quantity).slice(0, 5) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Dashboard</h1>
        <p className="text-muted-fg mt-1 text-sm">
          Enter sales, preview data, then run the forecast.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Manual entry">
          <form onSubmit={addManual} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Product
                <input
                  className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm"
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. Rice 5kg"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Date
                <input
                  type="date"
                  className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Quantity sold
                <input
                  type="number"
                  min={0}
                  step="1"
                  className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Sales amount
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm"
                  value={sales}
                  onChange={(e) => setSales(e.target.value)}
                  placeholder="0"
                />
              </label>
            </div>
            {formError ? (
              <p className="text-xs text-red-600" role="alert">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              className="rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
            >
              Add row
            </button>
          </form>
        </Card>

        <Card title="Upload files">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-muted-fg mb-2 text-xs">
                CSV or Excel with columns: product, date, quantity, sales. Try the{" "}
                <a
                  href="/sample-sales.csv"
                  className="text-accent underline underline-offset-2"
                  download
                >
                  sample CSV
                </a>
                .
              </p>
              <div className="flex flex-wrap gap-3">
                <label className="cursor-pointer rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                  Upload CSV
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onCsv}
                  />
                </label>
                <label className="cursor-pointer rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50">
                  Upload Excel
                  <input
                    type="file"
                    accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="hidden"
                    onChange={onExcel}
                  />
                </label>
              </div>
            </div>
            {fileError ? (
              <p className="text-xs text-red-600" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </Card>
      </div>

      <Card title="Dataset preview">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="text-muted-fg text-xs">{rows.length} row(s)</span>
          <button
            type="button"
            onClick={clearData}
            className="text-xs text-red-700 hover:underline"
          >
            Clear all
          </button>
        </div>
        <div className="max-h-64 overflow-auto rounded-lg border border-surface-border">
          <table className="w-full min-w-[480px] text-left text-xs">
            <thead className="sticky top-0 bg-neutral-100 text-neutral-700">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Date</th>
                <th className="px-3 py-2 font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Sales</th>
              </tr>
            </thead>
            <tbody>
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-fg px-3 py-6 text-center">
                    No data yet. Use the form or upload a file.
                  </td>
                </tr>
              ) : (
                previewRows.map((r, i) => (
                  <tr key={`${r.product}-${r.date}-${i}`} className="border-t border-surface-border">
                    <td className="px-3 py-2">{r.product}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.quantity}</td>
                    <td className="px-3 py-2">{r.sales}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="text-muted-fg flex items-center gap-2 text-xs">
            Forecast period
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
              className="rounded-md border border-surface-border px-2 py-1 text-sm text-neutral-900"
            >
              <option value="weekly">Weekly buckets</option>
              <option value="monthly">Monthly buckets</option>
            </select>
          </label>
          <button
            type="button"
            onClick={runForecast}
            disabled={loading || rows.length === 0}
            className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? "Running…" : "Run forecast"}
          </button>
        </div>
        {forecastError ? (
          <p className="mt-2 text-xs text-red-600" role="alert">
            {forecastError}
          </p>
        ) : null}
      </Card>

      {result ? (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Sales rhythm (Actual vs Prediction)">
              <SalesTrendChart data={result.salesTrend} />
            </Card>
            <Card title="Forecast vs actual (validation slice)">
              <ForecastVsActualChart data={result.forecastVsActual} />
            </Card>
          </div>
          <Card title="Next-period demand (best model)">
            <p className="text-muted-fg mb-3 text-xs">
              Best model:{" "}
              <span className="font-medium text-neutral-800">
                {result.models.find((m) => m.id === result.bestModel)?.name}
              </span>
            </p>
            <FutureDemandChart data={result.futureForecast} />
          </Card>
          <Card title="Product demand (units)">
            <ProductDemandBarChart data={result.productDemand} />
          </Card>
        </>
      ) : null}

      {result ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Best-selling products">
            <ul className="space-y-2 text-sm">
              {topProducts.map((p) => (
                <li
                  key={p.product}
                  className="flex justify-between border-b border-neutral-100 py-1"
                >
                  <span>{p.product}</span>
                  <span className="text-muted-fg">{p.quantity} units</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card title="Low-demand products">
            <ul className="space-y-2 text-sm">
              {lowProducts.map((p) => (
                <li
                  key={p.product}
                  className="flex justify-between border-b border-neutral-100 py-1"
                >
                  <span>{p.product}</span>
                  <span className="text-muted-fg">{p.quantity} units</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      ) : null}

      {result ? (
        <Card title="Restock suggestions">
          <ul className="space-y-3">
            {result.restock.map((r) => (
              <li
                key={r.product}
                className="flex flex-col gap-1 rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <span className="font-medium text-neutral-900">{r.product}</span>
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-xs ${
                      r.priority === "high"
                        ? "bg-red-50 text-red-800"
                        : r.priority === "medium"
                          ? "bg-amber-50 text-amber-900"
                          : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {r.priority}
                  </span>
                  <p className="text-muted-fg mt-1 text-xs">{r.reason}</p>
                </div>
                <div className="text-muted-fg shrink-0 text-xs">
                  Suggested order:{" "}
                  <span className="font-medium text-neutral-800">{r.suggestedUnits} units</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
