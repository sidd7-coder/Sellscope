"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Row = { date: string; actual?: number; predicted?: number };

export function ForecastVsActualChart({ data }: { data: Row[] }) {
  return (
    <div className="h-64 w-full">
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
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="#171717"
            strokeWidth={2}
            dot={false}
            name="Actual"
          />
          <Line
            type="monotone"
            dataKey="predicted"
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            name="Predicted"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
