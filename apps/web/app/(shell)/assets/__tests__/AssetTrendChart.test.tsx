import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NetWorthPoint } from "../../../../lib/data";

const tooltipRef = vi.hoisted(() => ({ content: null as any }));

vi.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: ({ dataKey, stroke }: any) => <div data-testid={`line-${dataKey}`} data-stroke={stroke} />,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }: any) => { tooltipRef.content = content; return null; },
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  Legend: () => null,
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { AssetTrendChart } from "../AssetTrendChart";
import type { AssetTrendSeries } from "../AssetTrendChart";

const points: NetWorthPoint[] = [
  { month: "2024-01", label: "Jan 24", value: 100000, formattedValue: "$100,000" },
  { month: "2024-02", label: "Feb 24", value: 120000, formattedValue: "$120,000" },
  { month: "2024-03", label: "Mar 24", value: 115000, formattedValue: "$115,000" },
];

const mockSeries: AssetTrendSeries[] = [
  { id: "net-worth", label: "Net worth", color: "var(--accent-soft)", data: points },
  { id: "asset-1", label: "My House", color: "var(--accent)", data: points },
];

const mockPayload = [{
  payload: {
    label: "Jan 24",
    "net-worth": 100000,
    "net-worth_formatted": "$100,000",
    "asset-1": 100000,
    "asset-1_formatted": "$100,000",
  }
}];

describe("AssetTrendChart", () => {
  it("renders a recharts LineChart when series has data", () => {
    render(<AssetTrendChart series={mockSeries} isVisible={true} />);
    expect(screen.getByTestId("line-chart")).toBeDefined();
  });

  it("renders one Line per series entry", () => {
    render(<AssetTrendChart series={mockSeries} isVisible={true} />);
    expect(screen.getByTestId("line-net-worth")).toBeDefined();
    expect(screen.getByTestId("line-asset-1")).toBeDefined();
  });

  it("renders an empty state when series array is empty", () => {
    render(<AssetTrendChart series={[]} isVisible={true} />);
    expect(screen.getByText("Add at least two monthly snapshots to see the trend.")).toBeDefined();
  });

  it("renders an empty state when all series have fewer than 2 points", () => {
    const thinSeries: AssetTrendSeries[] = [
      {
        id: "net-worth",
        label: "Net worth",
        color: "var(--accent-soft)",
        data: [{ month: "2024-01", label: "Jan 24", value: 100000, formattedValue: "$100,000" }],
      },
    ];
    render(<AssetTrendChart series={thinSeries} isVisible={true} />);
    expect(screen.getByText("Add at least two monthly snapshots to see the trend.")).toBeDefined();
  });

  it("shows raw values in tooltip when isVisible is true", () => {
    render(<AssetTrendChart series={mockSeries} isVisible={true} />);
    const { container } = render(tooltipRef.content({ active: true, payload: mockPayload }));
    expect(container.textContent).toContain("$100,000");
  });

  it("masks values in tooltip when isVisible is false", () => {
    render(<AssetTrendChart series={mockSeries} isVisible={false} />);
    const { container } = render(tooltipRef.content({ active: true, payload: mockPayload }));
    expect(container.textContent).not.toContain("$100,000");
  });
});
