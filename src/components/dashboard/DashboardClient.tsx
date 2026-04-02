"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import * as XLSX from "xlsx";
import type { ForecastResponse, SalesRow } from "@/lib/types";
import { cleanSalesRows } from "@/lib/clean";
import { parseCsvFile, parseExcelFile } from "@/lib/parseFiles";
import { Card } from "@/components/ui/Card";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { ForecastVsActualChart } from "@/components/charts/ForecastVsActualChart";
import { ProductDemandBarChart } from "@/components/charts/ProductDemandBarChart";
import { StockMixChart } from "@/components/charts/StockMixChart";

const manualSchema = z.object({
  product: z.string().min(1, "Product is required"),
  date: z.string().min(1, "Date is required"),
  quantity: z.coerce.number().nonnegative("Quantity must be 0 or more"),
  sales: z.coerce.number().nonnegative("Sales must be 0 or more"),
});

type DownloadFormat = "csv" | "xlsx" | "json";

function escapeCsvCell(val: string | number) {
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function DashboardClient() {
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [product, setProduct] = useState("");
  const [date, setDate] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [sales, setSales] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");
  const [downloadFormat, setDownloadFormat] = useState<DownloadFormat>("csv");

  const previewRows = useMemo(() => rows.slice(0, 200), [rows]);

  const bestModelName = useMemo(() => {
    if (!result) return null;
    return result.models.find((m) => m.id === result.bestModel)?.name ?? null;
  }, [result]);

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadDataset() {
    if (rows.length === 0) return;

    if (downloadFormat === "csv") {
      const csv = [
        "product,date,quantity,sales",
        ...rows.map((r) =>
          [escapeCsvCell(r.product), escapeCsvCell(r.date), r.quantity, r.sales].join(",")
        ),
      ].join("\n");
      triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), "sales_data.csv");
      return;
    }

    if (downloadFormat === "json") {
      const json = JSON.stringify(rows, null, 2);
      triggerDownload(new Blob([json], { type: "application/json" }), "sales_data.json");
      return;
    }

    const sheetData = rows.map((r) => ({
      product: r.product,
      date: r.date,
      quantity: r.quantity,
      sales: r.sales,
    }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sales");
    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    triggerDownload(
      new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
      "sales_data.xlsx"
    );
  }

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
    setQuantity("0");
    setSales("0");
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

  const secondaryBtn =
    "inline-flex items-center justify-center rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-50";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">Dashboard</h1>
        <p className="text-muted-fg mt-1 text-sm">
          Enter sales, preview data, then run the forecast.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Manual entry">
          <form onSubmit={addManual} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-neutral-700">
                Product
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="e.g. Rice 5kg"
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Date
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Quantity sold
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                />
              </label>
              <label className="block text-xs font-medium text-neutral-700">
                Sales amount
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={sales}
                  onChange={(e) => setSales(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-surface-border px-3 py-2 text-sm"
                />
              </label>
            </div>
            {formError ? (
              <p className="text-xs text-red-600" role="alert">
                {formError}
              </p>
            ) : null}
            <button type="submit" className={secondaryBtn}>
              Add row
            </button>
          </form>
        </Card>

        <Card title="Upload files">
          <p className="text-muted-fg mb-4 text-xs leading-relaxed">
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
          {fileError ? (
            <p className="mb-3 text-xs text-red-600" role="alert">
              {fileError}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <label className={`${secondaryBtn} cursor-pointer`}>
              Upload CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={onCsv} />
            </label>
            <label className={`${secondaryBtn} cursor-pointer`}>
              Upload Excel
              <input
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={onExcel}
              />
            </label>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900">Dataset preview</h3>
            <div className="text-muted-fg mt-1 text-xs">
              <span>{rows.length} row(s)</span>{" "}
              <button
                type="button"
                onClick={clearData}
                disabled={rows.length === 0}
                className="text-red-600 underline underline-offset-2 hover:text-red-700 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
              >
                Clear all
              </button>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
            <label className="text-muted-fg flex items-center gap-2 text-xs">
              Format
              <select
                value={downloadFormat}
                onChange={(e) => setDownloadFormat(e.target.value as DownloadFormat)}
                className="rounded-md border border-surface-border bg-white px-2 py-1.5 text-sm text-neutral-900"
              >
                <option value="csv">CSV</option>
                <option value="xlsx">Excel (.xlsx)</option>
                <option value="json">JSON</option>
              </select>
            </label>
            <button
              type="button"
              onClick={downloadDataset}
              disabled={rows.length === 0}
              className={`${secondaryBtn} disabled:cursor-not-allowed disabled:opacity-50`}
            >
              Download
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
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
              {previewRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-muted-fg py-8 text-center">
                    No data yet. Use the form or upload a file.
                  </td>
                </tr>
              ) : (
                previewRows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product}</td>
                    <td>{r.date}</td>
                    <td>{r.quantity}</td>
                    <td>{r.sales}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <label className="text-muted-fg flex items-center gap-2 text-sm">
            Forecast period
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
              className="rounded-md border border-surface-border px-2 py-1.5 text-sm text-neutral-900"
            >
              <option value="weekly">Weekly buckets</option>
              <option value="monthly">Monthly buckets</option>
            </select>
          </label>
          <button
            type="button"
            onClick={runForecast}
            disabled={rows.length === 0 || loading}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Running…" : "Run forecast"}
          </button>
        </div>
        {forecastError ? (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {forecastError}
          </p>
        ) : null}
      </Card>

      {result ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Sales rhythm (Actual vs AI prediction)">
              <SalesTrendChart data={result.salesTrend} />
            </Card>
            <Card title="Forecast vs actual (validation slice)">
              <ForecastVsActualChart data={result.forecastVsActual} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Overstocking vs understocking (risk)">
              <StockMixChart data={result.overstockUnderstock} />
            </Card>
            <Card title="Product demand (units)">
              <ProductDemandBarChart data={result.productDemand} />
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card title="Best model (auto-selected)">
              <p className="text-muted-fg mb-2 text-xs">
                Selected:{" "}
                <span className="font-medium text-neutral-800">{bestModelName ?? result.bestModel}</span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-surface-border text-neutral-600">
                      <th className="py-2 pr-4 font-medium">Model</th>
                      <th className="py-2 pr-4 font-medium">MAE</th>
                      <th className="py-2 pr-4 font-medium">RMSE</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.models.map((m) => (
                      <tr
                        key={m.id}
                        className={`border-b border-neutral-100 ${
                          m.id === result.bestModel ? "bg-teal-50/80" : ""
                        }`}
                      >
                        <td className="py-2 pr-4">{m.name}</td>
                        <td className="py-2 pr-4">{m.mae.toFixed(3)}</td>
                        <td className="py-2 pr-4">{m.rmse.toFixed(3)}</td>
                        <td className="py-2 text-muted-fg text-xs">
                          {m.id === result.bestModel ? "Selected" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Restock suggestions (from best model)">
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
