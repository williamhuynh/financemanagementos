import {
  Card,
  DonutChart,
  SectionHead
} from "@financelab/ui";
import {
  getAssetOverview,
  getCashFlowWaterfall,
  getExpenseBreakdown,
  getStatCards
} from "../../../lib/data";
import MonthSelector from "../reports/expenses/MonthSelector";
import WaterfallDrilldown from "./WaterfallDrilldown";

import SpendByCategoryControls from "./SpendByCategoryControls";
import { Suspense } from "react";
import type { NetWorthPoint, AssetCategorySummary } from "../../../lib/data";

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string;
    spendTop?: string;
    spendCategories?: string;
  }>;
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

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const statCards = await getStatCards();
  const assetOverview = await getAssetOverview();
  const breakdown = await getExpenseBreakdown(resolvedSearchParams?.month);
  const cashFlow = await getCashFlowWaterfall(resolvedSearchParams?.month);
  const spendByCategory = breakdown.categories;
  const availableCategories = spendByCategory.map((category) => category.name);
  const defaultSpendCategories = availableCategories.filter(
    (category) => category !== "Work Expenses - Primary"
  );
  const parsedSpendCategories = resolvedSearchParams?.spendCategories
    ? resolvedSearchParams.spendCategories
        .split(",")
        .map((category) => category.trim())
        .filter((category) => availableCategories.includes(category))
    : [];
  const selectedSpendCategories = parsedSpendCategories.length
    ? parsedSpendCategories
    : defaultSpendCategories;
  const spendTopRaw = Number(resolvedSearchParams?.spendTop ?? 3);
  const spendTop =
    Number.isFinite(spendTopRaw) && spendTopRaw > 0
      ? Math.min(Math.round(spendTopRaw), 6)
      : 3;
  const filteredSpend = spendByCategory.filter((category) =>
    selectedSpendCategories.includes(category.name)
  );
  const sortedSpend = [...filteredSpend].sort(
    (a, b) => Math.abs(b.amount) - Math.abs(a.amount)
  );
  const spendTotal = filteredSpend.reduce(
    (sum, item) => sum + Math.abs(item.amount),
    0
  );
  const topCategories = sortedSpend.slice(0, spendTop);
  const otherTotal = sortedSpend
    .slice(spendTop)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const segmentClasses = ["seg-a", "seg-b", "seg-c", "seg-d", "seg-e", "seg-f"];
  const dotClasses = ["a", "b", "c", "d", "e", "f"];
  const spendSegments = topCategories.map((item, index) => ({
    className: segmentClasses[index],
    value: Math.abs(item.amount)
  }));
  const spendLegend = topCategories.map((item, index) => ({
    label: `${item.name} ${
      spendTotal ? Math.round((Math.abs(item.amount) / spendTotal) * 100) : 0
    }%`,
    dot: dotClasses[index]
  }));
  const portfolioSplit = buildPortfolioSegments(assetOverview.categories);
  const netWorthPoints = buildTrendPoints(assetOverview.netWorthSeries);
  const hasNetWorthTrend = netWorthPoints.length > 0;
  const heroSub =
    assetOverview.lastUpdatedLabel === "No updates yet"
      ? "No updates yet"
      : `Last update: ${assetOverview.lastUpdatedLabel}`;

  if (otherTotal > 0 && spendTotal > 0) {
    const otherPercent = Math.round((otherTotal / spendTotal) * 100);
    spendSegments.push({ className: "seg-g", value: otherTotal });
    spendLegend.push({ label: `Other ${otherPercent}%`, dot: "g" });
  }

  return (
    <>
      <SectionHead
        eyebrow="Dashboard"
        title="Household Overview"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Overview" }
        ]}
      />
      <div className="hero">
        <div>
          <div className="eyebrow">Net Worth</div>
          <div className="hero-value">{assetOverview.netWorthFormatted}</div>
          <div className="hero-sub">{heroSub}</div>
        </div>
        <div className="hero-meta">
          <div className="meta-pill">{breakdown.totalFormatted} spend</div>
        </div>
      </div>
      <div className="dashboard-section">
        <div className="card-title">Assets snapshot</div>
        <div className="card-sub">Latest totals by category</div>
      </div>
      <div className="grid cards">
        {assetOverview.categories.map((category, index) => (
          <Card
            key={category.type}
            title={category.label}
            value={category.formattedValue}
            sub={category.subLabel}
            tone={category.tone as "glow" | "negative"}
            className={`card-${index}`}
          />
        ))}
      </div>
      {statCards.length > 0 ? (
        <div className="grid cards">
          {statCards.map((card, index) => (
            <Card
              key={card.title}
              title={card.title}
              value={card.value}
              sub={card.sub}
              tone={card.tone as "glow" | "negative"}
              className={`card-${index}`}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">No dashboard stats yet.</div>
      )}
      <div className="grid charts">
        {spendSegments.length > 0 ? (
          <DonutChart
            title="Spend by Category"
            actions={
              <>
                <Suspense fallback={<span className="pill">Loading...</span>}>
                  <MonthSelector
                    options={breakdown.monthOptions}
                    selected={breakdown.selectedMonth}
                    basePath="/dashboard"
                  />
                </Suspense>
                <SpendByCategoryControls
                  categories={availableCategories}
                  selectedCategories={selectedSpendCategories}
                  topCount={spendTop}
                />
              </>
            }
            segments={spendSegments}
            legend={spendLegend}
          />
        ) : (
          <article className="card chart">
            <div className="chart-head">
              <div className="card-title">Spend by Category</div>
            </div>
            <div className="empty-state">No spend data yet.</div>
          </article>
        )}
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
        <WaterfallDrilldown cashFlow={cashFlow} />
      </div>
    </>
  );
}
