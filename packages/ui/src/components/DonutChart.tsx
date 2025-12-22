import type { ReactNode } from "react";

type LegendItem = {
  label: string;
  dot: string;
};

type DonutSegment = {
  className: string;
  value: number;
};

type DonutChartProps = {
  title: string;
  segmentClasses?: string[];
  legend: LegendItem[];
  segments?: DonutSegment[];
  actions?: ReactNode;
};

const DONUT_CIRCUMFERENCE = 263;

export function DonutChart({
  title,
  segmentClasses = [],
  legend,
  segments,
  actions
}: DonutChartProps) {
  const activeSegments =
    segments?.filter((segment) => segment.value > 0) ?? [];
  const total = activeSegments.reduce((sum, segment) => sum + segment.value, 0);
  let offset = 0;

  const resolvedSegments =
    total > 0
      ? activeSegments.map((segment, index) => {
          const length = (segment.value / total) * DONUT_CIRCUMFERENCE;
          const dasharray = `${length} ${DONUT_CIRCUMFERENCE - length}`;
          const dashoffset = -offset;
          offset += length;
          return {
            key: `${segment.className}-${index}`,
            className: segment.className,
            dasharray,
            dashoffset
          };
        })
      : [];

  return (
    <article className="card chart">
      <div className="chart-head">
        <div className="card-title">{title}</div>
        {actions ? <div className="chart-actions">{actions}</div> : null}
      </div>
      <div className="chart-body">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="42" className="donut-base" />
          {resolvedSegments.length > 0
            ? resolvedSegments.map((segment) => (
                <circle
                  key={segment.key}
                  cx="60"
                  cy="60"
                  r="42"
                  className={`donut-seg ${segment.className}`}
                  style={{
                    strokeDasharray: segment.dasharray,
                    strokeDashoffset: segment.dashoffset
                  }}
                />
              ))
            : segmentClasses.map((className) => (
                <circle
                  key={className}
                  cx="60"
                  cy="60"
                  r="42"
                  className={`donut-seg ${className}`}
                />
              ))}
        </svg>
        <div className="chart-legend">
          {legend.map((item) => (
            <div key={item.label}>
              <span className={`dot ${item.dot}`}></span>
              {item.label}
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}
