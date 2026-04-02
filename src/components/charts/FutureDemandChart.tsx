"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { date: string; quantity: number };

export function FutureDemandChart({ data }: { data: Row[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#737373" />
          <YAxis tick={{ fontSize: 11 }} stroke="#737373" />
          <Tooltip
            contentStyle={{
              borderRadius: 8,
              border: "1px solid #e5e5e5",
              fontSize: 12,
            }}
          />
          <Line
            type="monotone"
            dataKey="quantity"
            stroke="#0f766e"
            strokeWidth={2}
            dot={{ r: 3 }}
            name="Forecast qty"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
