import { redirect } from "next/navigation";
import {
  getAssetOverview,
  getCashFlowWaterfall,
  getExpenseBreakdown
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";
import DashboardClient from "./DashboardClient";

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string;
    spendTop?: string;
    spendCategories?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const workspace = await getWorkspaceById(context.workspaceId);
  const homeCurrency = workspace?.currency ?? "AUD";

  // Fetch all dashboard data in parallel instead of sequentially
  const [assetOverview, breakdown, cashFlow] = await Promise.all([
    getAssetOverview(context.workspaceId, homeCurrency),
    getExpenseBreakdown(context.workspaceId, homeCurrency, resolvedSearchParams?.month),
    getCashFlowWaterfall(context.workspaceId, homeCurrency, resolvedSearchParams?.month),
  ]);
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

  return (
    <DashboardClient
      assetOverview={assetOverview}
      breakdown={breakdown}
      cashFlow={cashFlow}
      availableCategories={availableCategories}
      selectedSpendCategories={selectedSpendCategories}
      spendTop={spendTop}
      homeCurrency={homeCurrency}
    />
  );
}
