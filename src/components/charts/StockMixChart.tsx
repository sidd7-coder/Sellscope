"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { label: string; value: number };

export function StockMixChart({ data }: { data: Row[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="#737373"
            angle={-12}
            textAnchor="end"
            height={48}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="#737373"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            formatter={(v: number) => [`${v}%`, "Share"]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 12,
            }}
          />
          <Bar dataKey="value" fill="#14b8a6" radius={[4, 4, 0, 0]} name="Share" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
