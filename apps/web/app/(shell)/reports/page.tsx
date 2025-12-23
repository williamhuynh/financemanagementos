import { SectionHead } from "@financelab/ui";
import { getExpenseBreakdown, getMonthlyCloseSummary } from "../../../lib/data";
import MonthlyCloseClient from "./MonthlyCloseClient";

type ReportsPageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [summary, expenseBreakdown] = await Promise.all([
    getMonthlyCloseSummary(resolvedSearchParams?.month),
    getExpenseBreakdown(resolvedSearchParams?.month)
  ]);

  return (
    <>
      <SectionHead
        eyebrow="Reports"
        title="Monthly Close"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Reports" }
        ]}
        actions={
          <>
          </>
        }
      />
      <MonthlyCloseClient summary={summary} expenseBreakdown={expenseBreakdown} />
    </>
  );
}
