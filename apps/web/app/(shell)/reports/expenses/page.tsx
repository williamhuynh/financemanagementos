import Link from "next/link";
import { Card, DonutChart, ListRow, SectionHead } from "@financelab/ui";
import { getExpenseBreakdown } from "../../../../lib/data";
import ExpenseCategoryList from "./ExpenseCategoryList";
import MonthSelector from "./MonthSelector";

type ExpenseBreakdownPageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function ExpenseBreakdownPage({
  searchParams
}: ExpenseBreakdownPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const breakdown = await getExpenseBreakdown(resolvedSearchParams?.month);
  const spendByCategory = breakdown.categories;
  const totalSpend = breakdown.totalAmount;
  const totalFormatted = breakdown.totalFormatted;
  const topCategory = spendByCategory[0];
  const categoryCount = spendByCategory.length;
  const topCategories = spendByCategory.slice(0, 3);
  const otherTotal = spendByCategory.slice(3).reduce((sum, item) => sum + item.amount, 0);
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

  if (otherTotal > 0 && totalSpend > 0) {
    const otherPercent = Math.round((otherTotal / totalSpend) * 100);
    spendSegments.push({ className: "seg-d", value: otherTotal });
    spendLegend.push({ label: `Other ${otherPercent}%`, dot: "d" });
  }

  return (
    <>
      <SectionHead
        eyebrow="Reports"
        title="Expense Breakdown"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Expenses" }
        ]}
        actions={
          <>
            <Link className="pill" href="/reports">
              Back to reports
            </Link>
            <MonthSelector
              options={breakdown.monthOptions}
              selected={breakdown.selectedMonth}
              basePath="/reports/expenses"
            />
            <button className="pill" type="button">
              Export CSV
            </button>
          </>
        }
      />
      <div className="grid cards">
        <Card title="Total expenses" value={totalFormatted} sub="Recent activity" />
        <Card
          title="Top category"
          value={topCategory?.name ?? "No data"}
          sub={
            topCategory
              ? `${topCategory.percent}% of spend`
              : "No category totals yet"
          }
        />
        <Card
          title="Categories"
          value={`${categoryCount}`}
          sub="Active buckets"
        />
      </div>
      <div className="grid charts">
        <DonutChart
          title="Spend mix"
          segments={spendSegments}
          legend={spendLegend}
        />
        <article className="card">
          <div className="card-title">Category detail</div>
          <div className="list">
            {spendByCategory.map((item) => (
              <ListRow
                key={item.name}
                title={item.name}
                sub={`${item.count} transactions - ${item.percent}% of spend`}
                category={`${item.percent}% share`}
                amount={item.formattedAmount}
                tone="negative"
              />
            ))}
          </div>
        </article>
      </div>
      <div className="section-head">
        <div>
          <div className="eyebrow">Expense Detail</div>
          <h2>Recent transactions by category</h2>
        </div>
      </div>
      <ExpenseCategoryList
        categories={spendByCategory}
        selectedMonth={breakdown.selectedMonth}
      />
    </>
  );
}
