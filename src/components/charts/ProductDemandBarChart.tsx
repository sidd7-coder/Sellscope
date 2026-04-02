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

type Row = { product: string; quantity: number };

export function ProductDemandBarChart({ data }: { data: Row[] }) {
  const short = data.map((d) => ({
    ...d,
    label: d.product.length > 14 ? `${d.product.slice(0, 12)}…` : d.product,
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={short}
          layout="vertical"
          margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#737373" />
          <YAxis
            type="category"
            dataKey="label"
            width={100}
            tick={{ fontSize: 10 }}
            stroke="#737373"
          />
          <Tooltip
            formatter={(v: number) => [v, "Units"]}
            labelFormatter={(_, p) => {
              const item = p?.[0]?.payload as Row | undefined;
              return item?.product ?? "";
            }}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 12,
            }}
          />
          <Bar dataKey="quantity" fill="#0f766e" radius={[0, 4, 4, 0]} name="Demand" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
