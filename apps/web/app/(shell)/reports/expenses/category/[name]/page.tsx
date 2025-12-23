import Link from "next/link";
import { Card, ListRow, SectionHead } from "@financelab/ui";
import { getExpenseBreakdown } from "../../../../../../lib/data";
import MonthSelector from "../../MonthSelector";

type CategoryExpensePageProps = {
  params: Promise<{ name: string }>;
  searchParams?: Promise<{ month?: string }>;
};

export default async function CategoryExpensePage({
  params,
  searchParams
}: CategoryExpensePageProps) {
  const { name } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const categoryName = decodeURIComponent(name);
  const breakdown = await getExpenseBreakdown(resolvedSearchParams?.month);
  const category = breakdown.categories.find(
    (item) => item.name.toLowerCase() === categoryName.toLowerCase()
  );
  const backLink = breakdown.selectedMonth
    ? `/reports?month=${encodeURIComponent(breakdown.selectedMonth)}`
    : "/reports";
  const totalShare = category ? `${category.percent}% of spend` : "No data";

  return (
    <>
      <SectionHead
        eyebrow="Reports"
        title="Expense Category"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Reports", href: "/reports" },
          { label: "Expenses", href: "/reports" },
          { label: categoryName }
        ]}
        actions={
          <>
            <Link className="pill" href={backLink}>
              Back to reports
            </Link>
            <MonthSelector
              options={breakdown.monthOptions}
              selected={breakdown.selectedMonth}
              basePath={`/reports/expenses/category/${encodeURIComponent(categoryName)}`}
            />
            <span className="pill">{categoryName}</span>
          </>
        }
      />
      <div className="grid cards">
        <Card
          title="Total spend"
          value={category?.formattedAmount ?? "$0.00"}
          sub="Selected month"
        />
        <Card
          title="Transactions"
          value={`${category?.count ?? 0}`}
          sub="Matching items"
        />
        <Card title="Share of spend" value={totalShare} sub="Category mix" />
      </div>
      <article className="card">
        <div className="card-title">All transactions</div>
        <div className="list">
          {category?.transactions.map((txn) => (
            <ListRow
              key={txn.id}
              title={txn.title}
              sub={txn.sub}
              category={txn.category}
              amount={txn.amount}
              tone={txn.tone}
            />
          )) ?? <div className="empty-state">No transactions found.</div>}
        </div>
      </article>
    </>
  );
}
