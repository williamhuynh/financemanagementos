import { SectionHead } from "@tandemly/ui";
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
        title="Monthly Close"
      />
      <MonthlyCloseClient summary={summary} expenseBreakdown={expenseBreakdown} />
    </>
  );
}
