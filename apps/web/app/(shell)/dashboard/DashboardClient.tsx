"use client";

import {
  Card,
  DonutChart,
  SectionHead,
  TrendRangeToggle
} from "@tandemly/ui";
import type { TrendRange } from "@tandemly/ui";
import { Suspense, useMemo, useState } from "react";
import { useNumberVisibility } from "../../../lib/number-visibility-context";
import { maskCurrencyValue, formatCurrencyValue, filterSeriesByRange } from "../../../lib/data";
import MonthSelector from "../reports/expenses/MonthSelector";
import WaterfallDrilldown from "./WaterfallDrilldown";
import SpendByCategoryControls from "./SpendByCategoryControls";

import type {
  NetWorthPoint,
  AssetCategorySummary,
  AssetOverview,
  ExpenseBreakdown,
  CashFlowWaterfall
} from "../../../lib/data";

type DashboardClientProps = {
  assetOverview: AssetOverview;
  breakdown: ExpenseBreakdown;
  cashFlow: CashFlowWaterfall;
  availableCategories: string[];
  selectedSpendCategories: string[];
  spendTop: number;
  homeCurrency: string;
};

type DonutSegment = { className: string; value: number };
type DonutLegend = { label: string; dot: string };

function buildTrendPoints(series: NetWorthPoint[]) {
  if (series.length < 2) {
    return "";
  }
  const width = 360;
  const top = 20;
  const bottom = 120;
  const height = bottom - top;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const step = width / (series.length - 1);

  return series
    .map((point, index) => {
      const x = index * step;
      const normalized = (point.value - min) / range;
      const y = bottom - normalized * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function buildPortfolioSegments(categories: AssetCategorySummary[]) {
  const byType = new Map(categories.map((category) => [category.type, category]));
  const valueFor = (type: string) => byType.get(type)?.totalValue ?? 0;
  const netProperty =
    valueFor("property") + valueFor("liability") + valueFor("mortgage");
  const netCash = valueFor("cash") + valueFor("other_liability");
  const netCategories: AssetCategorySummary[] = [];

  if (netProperty !== 0) {
    netCategories.push({
      type: "property_net",
      label: "Property (net)",
      totalValue: netProperty,
      formattedValue: "",
      subLabel: "",
      tone: "glow"
    });
  }

  if (netCash !== 0) {
    netCategories.push({
      type: "cash_net",
      label: "Cash (net)",
      totalValue: netCash,
      formattedValue: "",
      subLabel: "",
      tone: "glow"
    });
  }

  const excludedTypes = new Set([
    "property",
    "liability",
    "mortgage",
    "other_liability",
    "cash"
  ]);

  for (const category of categories) {
    if (excludedTypes.has(category.type)) {
      continue;
    }
    netCategories.push(category);
  }

  const eligible = netCategories
    .filter((category) => (category.totalValue ?? 0) > 0)
    .sort((a, b) => (b.totalValue ?? 0) - (a.totalValue ?? 0));
  const total = eligible.reduce((sum, item) => sum + (item.totalValue ?? 0), 0);
  if (total <= 0) {
    return { segments: [], legend: [] };
  }
  const top = eligible.slice(0, 3);
  const otherTotal = eligible
    .slice(3)
    .reduce((sum, item) => sum + (item.totalValue ?? 0), 0);
  const segmentClasses = ["seg-a", "seg-b", "seg-c"];
  const dotClasses = ["a", "b", "c"];
  const segments: DonutSegment[] = top.map((item, index) => ({
    className: segmentClasses[index],
    value: item.totalValue ?? 0
  }));
  const legend: DonutLegend[] = top.map((item, index) => ({
    label: `${item.label} ${Math.round(((item.totalValue ?? 0) / total) * 100)}%`,
    dot: dotClasses[index]
  }));

  if (otherTotal > 0) {
    segments.push({ className: "seg-d", value: otherTotal });
    legend.push({
      label: `Other ${Math.round((otherTotal / total) * 100)}%`,
      dot: "d"
    });
  }

  return { segments, legend };
}

function getSelectedMonthLabel(
  monthOptions: Array<{ value: string; label: string }>,
  selectedMonth: string
): string {
  const match = monthOptions.find((option) => option.value === selectedMonth);
  return match?.label ?? selectedMonth;
}

export default function DashboardClient({
  assetOverview,
  breakdown,
  cashFlow,
  availableCategories,
  selectedSpendCategories,
  spendTop,
  homeCurrency
}: DashboardClientProps) {
  const { isVisible } = useNumberVisibility();

  const spendByCategory = breakdown.categories;
  const filteredSpend = spendByCategory.filter((category: any) =>
    selectedSpendCategories.includes(category.name)
  );
  const sortedSpend = [...filteredSpend].sort(
    (a: any, b: any) => Math.abs(b.amount) - Math.abs(a.amount)
  );
  const spendTotal = filteredSpend.reduce(
    (sum: number, item: any) => sum + Math.abs(item.amount),
    0
  );
  const topCategories = sortedSpend.slice(0, spendTop);
  const otherTotal = sortedSpend
    .slice(spendTop)
    .reduce((sum: number, item: any) => sum + Math.abs(item.amount), 0);
  const segmentClasses = ["seg-a", "seg-b", "seg-c", "seg-d", "seg-e", "seg-f"];
  const dotClasses = ["a", "b", "c", "d", "e", "f"];
  const spendSegments = topCategories.map((item: any, index: number) => ({
    className: segmentClasses[index],
    value: Math.abs(item.amount)
  }));
  const spendLegend = topCategories.map((item: any, index: number) => ({
    label: `${item.name} ${
      spendTotal ? Math.round((Math.abs(item.amount) / spendTotal) * 100) : 0
    }%`,
    dot: dotClasses[index]
  }));
  const portfolioSplit = buildPortfolioSegments(assetOverview.categories);
  const [trendRange, setTrendRange] = useState<TrendRange>("ALL");
  const filteredNetWorthSeries = useMemo(
    () => filterSeriesByRange(assetOverview.netWorthSeries, trendRange),
    [assetOverview.netWorthSeries, trendRange]
  );
  const netWorthPoints = buildTrendPoints(filteredNetWorthSeries);
  const hasNetWorthTrend = netWorthPoints.length > 0;
  const heroSub =
    assetOverview.lastUpdatedLabel === "No updates yet"
      ? "No updates yet"
      : `Last update: ${assetOverview.lastUpdatedLabel}`;
  const selectedMonthLabel = getSelectedMonthLabel(
    breakdown.monthOptions,
    breakdown.selectedMonth
  );

  if (otherTotal > 0 && spendTotal > 0) {
    const otherPercent = Math.round((otherTotal / spendTotal) * 100);
    spendSegments.push({ className: "seg-g", value: otherTotal });
    spendLegend.push({ label: `Other ${otherPercent}%`, dot: "g" });
  }

  return (
    <>
      <SectionHead
        title="Household Overview"
      />

      {/* ── Position: where you stand (latest data) ── */}
      <div className="hero">
        <div>
          <div className="eyebrow">Net Worth</div>
          <div className="hero-value">
            {maskCurrencyValue(assetOverview.netWorthFormatted, isVisible)}
          </div>
          <div className="hero-sub">{heroSub}</div>
        </div>
      </div>
      <div className="dashboard-section">
        <div className="card-title">Assets snapshot</div>
        <div className="card-sub">Latest totals by category</div>
      </div>
      <div className="grid cards">
        {assetOverview.categories.map((category: any, index: number) => (
          <Card
            key={category.type}
            title={category.label}
            value={maskCurrencyValue(category.formattedValue, isVisible)}
            sub={category.subLabel}
            tone={category.tone as "glow" | "negative"}
            className={`card-${index}`}
          />
        ))}
      </div>
      <div className="grid charts">
        {portfolioSplit.segments.length > 0 ? (
          <DonutChart
            title="Portfolio Split"
            segments={portfolioSplit.segments}
            legend={portfolioSplit.legend}
          />
        ) : (
          <article className="card chart">
            <div className="chart-head">
              <div className="card-title">Portfolio Split</div>
            </div>
            <div className="empty-state">Add asset snapshots to see the split.</div>
          </article>
        )}
        <article className="card chart wide">
          <div className="chart-head">
            <div className="card-title">Net Worth Trend</div>
            <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
          </div>
          <div className="chart-body">
            {hasNetWorthTrend ? (
              <svg viewBox="0 0 360 140" aria-hidden="true">
                <polyline className="trend" points={netWorthPoints} />
              </svg>
            ) : (
              <div className="empty-state">Add monthly snapshots to see the trend.</div>
            )}
          </div>
        </article>
      </div>

      {/* ── Activity: what happened this month (month-anchored) ── */}
      <div className="dashboard-flow-header">
        <div>
          <div className="card-title">Activity</div>
          <div className="card-sub">
            Income, spending, and cash flow for {selectedMonthLabel}
          </div>
        </div>
        <Suspense fallback={<span className="pill">Loading...</span>}>
          <MonthSelector
            options={breakdown.monthOptions}
            selected={breakdown.selectedMonth}
            basePath="/dashboard"
          />
        </Suspense>
      </div>
      <div className="grid charts">
        {spendSegments.length > 0 ? (
          <DonutChart
            title="Spend by Category"
            actions={
              <SpendByCategoryControls
                categories={availableCategories}
                selectedCategories={selectedSpendCategories}
                topCount={spendTop}
              />
            }
            segments={spendSegments}
            legend={spendLegend}
          />
        ) : (
          <article className="card chart">
            <div className="chart-head">
              <div className="card-title">Spend by Category</div>
            </div>
            <div className="empty-state">No spend data for {selectedMonthLabel}.</div>
          </article>
        )}
        <article className={`card chart${cashFlow.netTotal < 0 ? " negative" : ""}`}>
          <div className="chart-head">
            <div className="card-title">Net Cash Flow</div>
          </div>
          <div
            className="cash-flow-value"
            style={{ color: cashFlow.netTotal >= 0 ? "var(--asset)" : "var(--liability)" }}
          >
            {maskCurrencyValue(
              formatCurrencyValue(cashFlow.netTotal, homeCurrency),
              isVisible
            )}
          </div>
          {cashFlow.previousMonthNetTotal !== null && (
            <div className="cash-flow-prev">
              <span className="cash-flow-prev-label">Last month:</span>{" "}
              <span>
                {maskCurrencyValue(
                  formatCurrencyValue(cashFlow.previousMonthNetTotal, homeCurrency),
                  isVisible
                )}
              </span>
              {cashFlow.previousMonthNetTotal !== 0 && (
                <span
                  className="cash-flow-change"
                  style={{
                    color:
                      cashFlow.netTotal >= cashFlow.previousMonthNetTotal
                        ? "var(--asset)"
                        : "var(--liability)"
                  }}
                >
                  {(() => {
                    const pct = Math.round(
                      ((cashFlow.netTotal - cashFlow.previousMonthNetTotal) /
                        Math.abs(cashFlow.previousMonthNetTotal)) *
                        100
                    );
                    return `${pct >= 0 ? "+" : ""}${pct}%`;
                  })()}
                </span>
              )}
            </div>
          )}
        </article>
        <WaterfallDrilldown cashFlow={cashFlow} />
      </div>
    </>
  );
}
