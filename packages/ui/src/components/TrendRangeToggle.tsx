"use client";

export type TrendRange = "1M" | "3M" | "YTD" | "1Y" | "ALL";

type TrendRangeToggleProps = {
  value: TrendRange;
  onChange: (range: TrendRange) => void;
};

const ranges: { key: TrendRange; label: string }[] = [
  { key: "1M", label: "1M" },
  { key: "3M", label: "3M" },
  { key: "YTD", label: "YTD" },
  { key: "1Y", label: "1 Yr" },
  { key: "ALL", label: "All" },
];

export function TrendRangeToggle({ value, onChange }: TrendRangeToggleProps) {
  return (
    <div className="trend-range-toggle">
      {ranges.map((range) => (
        <button
          key={range.key}
          type="button"
          className={`trend-range-btn${value === range.key ? " active" : ""}`}
          onClick={() => onChange(range.key)}
          aria-pressed={value === range.key}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
