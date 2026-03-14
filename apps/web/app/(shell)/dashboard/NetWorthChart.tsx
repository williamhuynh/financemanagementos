"use client";

import {
  LineChart,
  Line,
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  type TooltipProps,
} from "recharts";
import type { NetWorthPoint } from "../../../lib/data";

type Props = {
  series: NetWorthPoint[];
};

function NetWorthTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload as NetWorthPoint;
  return (
    <div className="net-worth-tooltip">
      <div className="net-worth-tooltip-label">{point.label}</div>
      <div className="net-worth-tooltip-value">{point.formattedValue}</div>
    </div>
  );
}

export function NetWorthChart({ series }: Props) {
  const hasData = series.length >= 2;

  if (!hasData) {
    return (
      <div className="empty-state">Add monthly snapshots to see the trend.</div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <LineChart
        data={series}
        margin={{ left: 0, right: 0, top: 8, bottom: 0 }}
      >
        <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
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
          content={<NetWorthTooltip />}
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
