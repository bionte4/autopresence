"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function TrendChart({ data }: { data: Array<{ bucket: string; lateEvents: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-2">Tidak ada keterlambatan pada periode ini.</p>;
  }
  return (
    <div className="h-56 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="bucket" tick={{ fontSize: 12 }} stroke="var(--ink-2)" />
          <YAxis allowDecimals={false} width={32} tick={{ fontSize: 12 }} stroke="var(--ink-2)" />
          <Tooltip />
          <Bar dataKey="lateEvents" name="Keterlambatan" fill="var(--primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
