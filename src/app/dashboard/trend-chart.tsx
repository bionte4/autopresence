"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipContentProps } from "recharts";
import { trendAxisLabel, trendTipLabel } from "./trend-label";

function TrendTip({ active, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as { tip?: string; lateEvents?: number } | undefined;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-sm">
      <p className="text-ink-2">{point?.tip}</p>
      <p className="font-semibold tabular-nums">{point?.lateEvents ?? 0} kejadian</p>
    </div>
  );
}

export function TrendChart({ data }: { data: Array<{ bucket: string; lateEvents: number }> }) {
  if (data.length === 0) {
    return <p className="text-sm text-ink-2">Tidak ada keterlambatan pada periode ini.</p>;
  }
  const points = data.map((point) => ({
    label: trendAxisLabel(point.bucket),
    tip: trendTipLabel(point.bucket),
    lateEvents: point.lateEvents,
  }));
  const peak = Math.max(...points.map((point) => point.lateEvents), 1);
  const ceiling = peak + 1;
  return (
    <div className="h-48 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--ink-2)" />
          <YAxis
            domain={[0, ceiling]}
            ticks={ceiling <= 8 ? Array.from({ length: ceiling + 1 }, (_, index) => index) : undefined}
            allowDecimals={false}
            width={32}
            tick={{ fontSize: 12 }}
            stroke="var(--ink-2)"
          />
          <Tooltip content={TrendTip} cursor={{ fill: "var(--surface-2)" }} />
          <Bar dataKey="lateEvents" name="Keterlambatan" fill="var(--primary)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
