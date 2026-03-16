"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { NetWorthPoint } from "../../../lib/data";

export type AssetTrendSeries = {
  id: string;
  label: string;
  color: string;
  data: NetWorthPoint[];
};

type Props = {
  series: AssetTrendSeries[];
};

type MergedPoint = {
  label: string;
  [seriesId: string]: string | number;
};

function mergeSeriesData(series: AssetTrendSeries[]): MergedPoint[] {
  // Build a unified timeline from all series labels
  const labelOrder: string[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    for (const p of s.data) {
      if (!seen.has(p.label)) {
        labelOrder.push(p.label);
        seen.add(p.label);
      }
    }
  }

  return labelOrder.map((label) => {
    const point: MergedPoint = { label };
    for (const s of series) {
      const match = s.data.find((p) => p.label === label);
      if (match !== undefined) {
        point[s.id] = match.value;
        point[`${s.id}_formatted`] = match.formattedValue;
      }
    }
    return point;
  });
}

export function AssetTrendChart({ series }: Props) {
  const hasData = series.some((s) => s.data.length >= 2);

  if (!hasData) {
    return (
      <div className="empty-state">Add at least two monthly snapshots to see the trend.</div>
    );
  }

  const merged = mergeSeriesData(series);
  const allValues = series.flatMap((s) => s.data.map((p) => p.value));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || Math.abs(maxVal) * 0.05 || 1000;
  const pad = range * 0.2;
  const yDomain: [number, number] = [minVal - pad, maxVal + pad];

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={merged} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
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
            const label = payload[0]?.payload?.label as string;
            return (
              <div className="net-worth-tooltip">
                <div className="net-worth-tooltip-label">{label}</div>
                {series.map((s) => {
                  const formatted = payload[0]?.payload?.[`${s.id}_formatted`] as string | undefined;
                  if (!formatted) return null;
                  return (
                    <div key={s.id} className="net-worth-tooltip-row">
                      <span
                        className="legend-swatch"
                        style={{ background: s.color, display: "inline-block", width: 8, height: 8, borderRadius: 2, marginRight: 6 }}
                      />
                      <span style={{ color: "var(--text-secondary)", fontSize: 11, marginRight: 6 }}>{s.label}</span>
                      <span>{formatted}</span>
                    </div>
                  );
                })}
              </div>
            );
          }}
        />
        {series.map((s) => (
          <Line
            key={s.id}
            dataKey={s.id}
            type="natural"
            stroke={s.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: s.color, strokeWidth: 0 }}
            connectNulls
          />
        ))}
        <Legend
          iconType="plainline"
          iconSize={16}
          wrapperStyle={{ fontSize: 11, color: "var(--text-secondary)", paddingTop: 8 }}
          formatter={(value: string) => {
            const s = series.find((x) => x.id === value);
            return s?.label ?? value;
          }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
