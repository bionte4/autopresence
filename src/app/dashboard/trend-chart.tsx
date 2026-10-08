"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: Array<{ bucket: string; lateEvents: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-2">Tidak ada keterlambatan pada periode ini.</p>;
  }
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="lateEvents" name="Keterlambatan" fill="#27439B" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
