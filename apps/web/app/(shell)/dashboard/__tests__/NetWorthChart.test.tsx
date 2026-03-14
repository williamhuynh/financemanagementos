import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NetWorthPoint } from "../../../../lib/data";

// Mock recharts — jsdom doesn't support SVG rendering fully
vi.mock("recharts", () => ({
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: ({ content }: any) => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

// Mock next/navigation (used in DashboardClient but not NetWorthChart — defensive)
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { NetWorthChart } from "../NetWorthChart";

const mockSeries: NetWorthPoint[] = [
  { month: "2024-01", label: "Jan 24", value: 100000, formattedValue: "$100,000" },
  { month: "2024-02", label: "Feb 24", value: 120000, formattedValue: "$120,000" },
  { month: "2024-03", label: "Mar 24", value: 115000, formattedValue: "$115,000" },
];

describe("NetWorthChart", () => {
  it("renders a recharts LineChart when series has data", () => {
    render(<NetWorthChart series={mockSeries} />);
    expect(screen.getByTestId("line-chart")).toBeDefined();
  });

  it("renders an empty state when series is empty", () => {
    render(<NetWorthChart series={[]} />);
    expect(screen.getByText("Add monthly snapshots to see the trend.")).toBeDefined();
  });

  it("renders an empty state when series has only one point", () => {
    const single: NetWorthPoint[] = [
      { month: "2024-01", label: "Jan 24", value: 100000, formattedValue: "$100,000" },
    ];
    render(<NetWorthChart series={single} />);
    expect(screen.getByText("Add monthly snapshots to see the trend.")).toBeDefined();
  });
});
