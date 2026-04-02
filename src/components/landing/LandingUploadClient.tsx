"use client";

import { useMemo, useState } from "react";
import type { ForecastResponse, SalesRow } from "@/lib/types";
import type { CanonicalField, DetectedMapping } from "@/lib/columnMapping";
import {
  canonicalFieldLabels,
  type DetectedMapping as DetectedMappingType,
} from "@/lib/columnMapping";
import { SalesTrendChart } from "@/components/charts/SalesTrendChart";
import { ForecastVsActualChart } from "@/components/charts/ForecastVsActualChart";
import { ProductDemandBarChart } from "@/components/charts/ProductDemandBarChart";
import { StockMixChart } from "@/components/charts/StockMixChart";
import { Card } from "@/components/ui/Card";

function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

type IngestNeedsMapping = {
  status: "needs_mapping";
  headers: string[];
  detected: DetectedMappingType;
  missing: CanonicalField[];
};

type IngestOk = {
  status: "ok";
  rows: SalesRow[];
  headers: string[];
  detected: DetectedMappingType;
};

type IngestError = {
  status: "error";
  error: string;
};

export function LandingUploadClient() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly");

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileLabel, setFileLabel] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedMappingType>({});
  const [missing, setMissing] = useState<CanonicalField[]>([]);
  const [mapping, setMapping] = useState<DetectedMappingType>({});

  const [rows, setRows] = useState<SalesRow[] | null>(null);
  const [result, setResult] = useState<ForecastResponse | null>(null);

  const [status, setStatus] = useState<
    "idle" | "detecting" | "needs_mapping" | "ready" | "forecasting" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  const bestModelName = useMemo(() => {
    if (!result) return null;
    return result.models.find((m) => m.id === result.bestModel)?.name ?? null;
  }, [result]);

  async function ingestFile(file: File, providedMapping?: DetectedMapping) {
    const buf = await file.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);

    setError(null);
    const res = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        base64,
        autoDetect: true,
        mapping: providedMapping && Object.keys(providedMapping).length ? providedMapping : undefined,
        period,
      }),
    });

    const data = (await res.json()) as IngestNeedsMapping | IngestOk | IngestError;
    if (!res.ok || data.status === "error") {
      throw new Error(data.status === "error" ? data.error : "Could not parse file.");
    }
    return data;
  }

  async function runForecastFromRows(rowsToUse: SalesRow[]) {
    setStatus("forecasting");
    setError(null);
    const res = await fetch("/api/forecast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows: rowsToUse, period }),
    });
    const data = (await res.json()) as { error?: string } & Partial<ForecastResponse>;
    if (!res.ok || data.error || !data.bestModel) {
      throw new Error(data.error ?? "Forecast failed.");
    }
    setResult(data as ForecastResponse);
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    setSelectedFile(f);
    setFileLabel(f.name);
    setResult(null);
    setRows(null);
    setError(null);
    setStatus("detecting");

    try {
      const ingest = (await ingestFile(f)) as IngestNeedsMapping | IngestOk;
      if (ingest.status === "needs_mapping") {
        setHeaders(ingest.headers);
        setDetected(ingest.detected);
        setMissing(ingest.missing);
        setMapping(ingest.detected);
        setStatus("needs_mapping");
        return;
      }
      // Auto-detected everything; forecast immediately.
      setHeaders(ingest.headers);
      setDetected(ingest.detected);
      setMissing([]);
      setMapping(ingest.detected);
      setRows(ingest.rows);
      await runForecastFromRows(ingest.rows);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not process file.");
    }
  }

  async function runForecastAfterMapping() {
    if (!selectedFile) return;
    setError(null);
    setStatus("detecting");
    try {
      const ingest = (await ingestFile(selectedFile, mapping)) as IngestOk;
      setRows(ingest.rows);
      await runForecastFromRows(ingest.rows);
      setStatus("ready");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not run forecast.");
    }
  }

  function setMappingFor(field: CanonicalField, headerValue: string) {
    setMapping((prev) => ({ ...prev, [field]: headerValue }));
  }

  const mappedSummary = useMemo(() => {
    const entries = (["product", "date", "quantity", "sales"] as CanonicalField[]).map((f) => ({
      field: f,
      header: mapping[f] ?? detected[f] ?? "",
    }));
    return entries;
  }, [mapping, detected]);

  return (
    <Card title="Upload sales data (CSV/Excel)">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-muted-fg text-xs">
              Expected columns (case-insensitive): <span className="font-medium text-neutral-700">product</span>,{" "}
              <span className="font-medium text-neutral-700">date</span>,{" "}
              <span className="font-medium text-neutral-700">quantity</span>,{" "}
              <span className="font-medium text-neutral-700">sales</span>.
              <span className="ml-2">
                <a
                  href="/sample-sales.csv"
                  className="text-accent underline underline-offset-2"
                  download
                >
                  Download sample CSV
                </a>
              </span>
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-surface-border bg-white px-4 py-2 text-sm font-medium hover:bg-neutral-50">
              Select file
              <input
                id="sellscope-upload"
                type="file"
                accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
            {fileLabel ? <p className="text-xs text-muted-fg">Selected: {fileLabel}</p> : null}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-muted-fg flex items-center gap-2 text-xs">
              Forecast period
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as "weekly" | "monthly")}
                className="rounded-md border border-surface-border px-2 py-1 text-sm text-neutral-900"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
        </div>

        {status === "needs_mapping" ? (
          <div className="rounded-lg border border-surface-border bg-surface p-3">
            <div className="mb-2">
              <p className="text-sm font-semibold text-neutral-900">
                We detected some columns, but mapping is incomplete.
              </p>
              <p className="text-muted-fg mt-1 text-xs">
                Confirm (or choose) which file columns map to Product, Date, Quantity, Sales.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {(missing.length ? missing : (["product", "date", "quantity", "sales"] as CanonicalField[])).map(
                (f) => (
                  <label key={f} className="block text-xs font-medium text-neutral-700">
                    {canonicalFieldLabels[f]}
                    <select
                      value={mapping[f] ?? detected[f] ?? ""}
                      onChange={(e) => setMappingFor(f, e.target.value)}
                      className="mt-1 w-full rounded-md border border-surface-border px-3 py-2 text-sm"
                    >
                      <option value="" disabled>
                        Select column
                      </option>
                      {headers.map((h, idx) => (
                        <option key={`${h}-${idx}`} value={h} disabled={!h}>
                          {h || `Column ${idx + 1} (blank header)`}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={runForecastAfterMapping}
                className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-teal-800"
              >
                Run forecast
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[420px] text-left text-xs">
                <thead>
                  <tr className="border-b border-surface-border text-neutral-600">
                    <th className="py-2 pr-4 font-medium">Field</th>
                    <th className="py-2 font-medium">Mapped column</th>
                  </tr>
                </thead>
                <tbody>
                  {mappedSummary.map((x) => (
                    <tr key={x.field} className="border-b border-neutral-100">
                      <td className="py-2 pr-4 font-medium">{canonicalFieldLabels[x.field]}</td>
                      <td className="py-2 text-muted-fg">{x.header || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {status === "error" || error ? (
          <p className="text-xs text-red-600" role="alert">
            {error ?? "Something went wrong."}
          </p>
        ) : null}

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
    </Card>
  );
}

