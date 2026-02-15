import { SectionHead } from "@tandemly/ui";
import { redirect } from "next/navigation";
import { getExpenseBreakdown, getMonthlyCloseSummary } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";
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
  const workspace = await getWorkspaceById(context.workspaceId);
  const homeCurrency = workspace?.currency ?? "AUD";
  const [summary, expenseBreakdown] = await Promise.all([
    getMonthlyCloseSummary(context.workspaceId, homeCurrency, resolvedSearchParams?.month),
    getExpenseBreakdown(context.workspaceId, homeCurrency, resolvedSearchParams?.month)
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
