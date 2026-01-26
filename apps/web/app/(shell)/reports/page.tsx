import { SectionHead } from "@financelab/ui";
import { redirect } from "next/navigation";
import { getExpenseBreakdown, getMonthlyCloseSummary } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import MonthlyCloseClient from "./MonthlyCloseClient";

type ReportsPageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const [summary, expenseBreakdown] = await Promise.all([
    getMonthlyCloseSummary(context.workspaceId, resolvedSearchParams?.month),
    getExpenseBreakdown(context.workspaceId, resolvedSearchParams?.month)
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
