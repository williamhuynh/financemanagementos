"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { NetWorthPoint } from "../../../lib/data";

type Props = {
  series: NetWorthPoint[];
};


export function NetWorthChart({ series }: Props) {
  const hasData = series.length >= 2;

  if (!hasData) {
    return (
      <div className="empty-state">Add monthly snapshots to see the trend.</div>
    );
  }

  const values = series.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || Math.abs(maxVal) * 0.05 || 1000;
  const pad = range * 0.2;
  const yDomain: [number, number] = [minVal - pad, maxVal + pad];

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart
        data={series}
        margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
        <YAxis domain={yDomain} hide />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--text-secondary)", fontSize: 11 }}
          tickMargin={8}
          tickFormatter={(value: string) => value.slice(0, 6)}
        />
        <Tooltip
          cursor={{ stroke: "rgba(255,255,255,0.1)" }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content={({ active, payload }: any) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as NetWorthPoint;
            return (
              <div className="net-worth-tooltip">
                <div className="net-worth-tooltip-label">{point.label}</div>
                <div className="net-worth-tooltip-value">{point.formattedValue}</div>
              </div>
            );
          }}
        />
        <Line
          dataKey="value"
          type="natural"
          stroke="var(--accent)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--accent)", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
