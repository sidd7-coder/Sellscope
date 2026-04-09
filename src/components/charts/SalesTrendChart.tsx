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

type Point = {
  date: string;
  actualQuantity: number;
  predictedQuantity: number;
};

export function SalesTrendChart({
  data,
  future,
}: {
  data: Point[];
  future?: { date: string; quantity: number }[];
}) {
  const chartData = (() => {
    if (!data.length) return [];
    const lastActual = data[data.length - 1];
    const actualSeries = data.map((p, idx) => ({
      date: p.date,
      actualQuantity: p.actualQuantity,
      predictedQuantity: idx === data.length - 1 ? lastActual.actualQuantity : null,
    }));
    const futureSeries = (future ?? []).map((p) => ({
      date: p.date,
      actualQuantity: null,
      predictedQuantity: p.quantity,
    }));
    return [...actualSeries, ...futureSeries];
  })();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
            dataKey="actualQuantity"
            stroke="#171717"
            strokeWidth={2}
            dot={false}
            name="Actual sales"
          />
          <Line
            type="monotone"
            dataKey="predictedQuantity"
            stroke="#0f766e"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            name="AI prediction"
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
