"use client";

type WaterfallStep = {
  label: string;
  value: number;
  formattedValue?: string;
  kind?: "income" | "expense" | "net";
  transactions?: unknown[];
};

type WaterfallChartProps = {
  title?: string;
  steps?: WaterfallStep[];
  height?: number;
  activeStepLabel?: string | null;
  onStepClick?: (step: WaterfallStep) => void;
};

const defaultSteps: WaterfallStep[] = [
  { label: "Income", value: 19380, formattedValue: "+$19,380", kind: "income" },
  { label: "Housing", value: -4580, formattedValue: "-$4,580", kind: "expense" },
  {
    label: "Groceries",
    value: -1860,
    formattedValue: "-$1,860",
    kind: "expense"
  },
  { label: "Utilities", value: -640, formattedValue: "-$640", kind: "expense" },
  {
    label: "Transport",
    value: -430,
    formattedValue: "-$430",
    kind: "expense"
  },
  { label: "Net", value: 11870, formattedValue: "+$11,870", kind: "net" }
];

export function WaterfallChart({
  title = "Cash Flow Waterfall",
  steps = defaultSteps,
  height = 150,
  activeStepLabel = null,
  onStepClick
}: WaterfallChartProps) {
  let cumulative = 0;
  const series = steps.map((step) => {
    if (step.kind === "net") {
      return { ...step, start: 0, end: step.value };
    }
    const start = cumulative;
    const end = cumulative + step.value;
    cumulative = end;
    return { ...step, start, end };
  });

  const rangeValues = series.flatMap((item) => [item.start, item.end, 0]);
  const minValue = Math.min(...rangeValues);
  const maxValue = Math.max(...rangeValues);
  const range = maxValue - minValue || 1;
  const scale = (value: number) => ((value - minValue) / range) * height;
  const zeroOffset = scale(0);
  const isInteractive = Boolean(onStepClick);

  return (
    <article className="card chart wide">
      <div className="card-title">{title}</div>
      <div
        className="chart-body waterfall"
        style={{
          ["--waterfall-height" as const]: `${height}px`,
          ["--waterfall-zero" as const]: `${zeroOffset}px`
        }}
      >
        {series.map((step, index) => {
          const barStart = Math.min(step.start, step.end);
          const barEnd = Math.max(step.start, step.end);
          const barHeight = Math.max(scale(barEnd) - scale(barStart), 6);
          const barOffset = scale(barStart);
          const displayValue =
            step.formattedValue ??
            `${step.value >= 0 ? "+" : "-"}$${Math.abs(step.value).toFixed(0)}`;
          const barLabel =
            step.kind === "net" ? `Net ${displayValue}` : displayValue;
          const titleText = `${step.label} ${displayValue}`;
          const isActive = activeStepLabel === step.label;
          const isRefund = step.kind === "expense" && step.value > 0;

          return (
            <div key={`${step.label}-${index}`} className="waterfall-col">
              <div className="waterfall-stack">
                <button
                  className={`waterfall-bar ${step.kind ?? "expense"}${
                    isRefund ? " refund" : ""
                  }${isActive ? " active" : ""}`}
                  style={{ height: `${barHeight}px`, bottom: `${barOffset}px` }}
                  title={titleText}
                  aria-label={titleText}
                  aria-pressed={isActive}
                  type="button"
                  onClick={() => onStepClick?.(step)}
                  disabled={!isInteractive}
                >
                  <span className="waterfall-value">{barLabel}</span>
                </button>
              </div>
              <span className="waterfall-label" title={step.label}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </article>
  );
}
