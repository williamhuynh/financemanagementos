import {
  Card,
  DonutChart,
  Hero,
  SectionHead,
  TrendChart,
  WaterfallChart
} from "@financelab/ui";
import {
  getCashFlowWaterfall,
  getExpenseBreakdown,
  getStatCards
} from "../../../lib/data";
import MonthSelector from "../reports/expenses/MonthSelector";

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const statCards = await getStatCards();
  const breakdown = await getExpenseBreakdown(resolvedSearchParams?.month);
  const cashFlow = await getCashFlowWaterfall(resolvedSearchParams?.month);
  const spendByCategory = breakdown.categories;
  const spendTotal = spendByCategory.reduce((sum, item) => sum + item.amount, 0);
  const topCategories = spendByCategory.slice(0, 3);
  const otherTotal = spendByCategory
    .slice(3)
    .reduce((sum, item) => sum + item.amount, 0);
  const segmentClasses = ["seg-a", "seg-b", "seg-c"];
  const dotClasses = ["a", "b", "c"];
  const spendSegments = topCategories.map((item, index) => ({
    className: segmentClasses[index],
    value: item.amount
  }));
  const spendLegend = topCategories.map((item, index) => ({
    label: `${item.name} ${item.percent}%`,
    dot: dotClasses[index]
  }));

  if (otherTotal > 0 && spendTotal > 0) {
    const otherPercent = Math.round((otherTotal / spendTotal) * 100);
    spendSegments.push({ className: "seg-d", value: otherTotal });
    spendLegend.push({ label: `Other ${otherPercent}%`, dot: "d" });
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
        actions={
          <>
            <button className="pill" type="button">
              Snapshot
            </button>
            <button className="pill" type="button">
              Add note
            </button>
          </>
        }
      />
      <Hero />
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
      <div className="grid charts">
        <DonutChart
          title="Spend by Category"
          actions={
            <MonthSelector
              options={breakdown.monthOptions}
              selected={breakdown.selectedMonth}
              basePath="/dashboard"
            />
          }
          segments={spendSegments}
          legend={spendLegend}
        />
        <DonutChart
          title="Portfolio Split"
          segmentClasses={["seg-e", "seg-f", "seg-g"]}
          legend={[
            { label: "High growth 43%", dot: "e" },
            { label: "Property 30%", dot: "f" },
            { label: "Cash 8%", dot: "g" }
          ]}
        />
        <TrendChart />
        <WaterfallChart steps={cashFlow.steps} />
      </div>
    </>
  );
}
