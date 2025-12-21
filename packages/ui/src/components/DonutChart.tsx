type LegendItem = {
  label: string;
  dot: string;
};

type DonutChartProps = {
  title: string;
  segmentClasses: string[];
  legend: LegendItem[];
};

export function DonutChart({ title, segmentClasses, legend }: DonutChartProps) {
  return (
    <article className="card chart">
      <div className="card-title">{title}</div>
      <div className="chart-body">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="42" className="donut-base" />
          {segmentClasses.map((className) => (
            <circle key={className} cx="60" cy="60" r="42" className={`donut-seg ${className}`} />
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
