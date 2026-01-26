import { redirect } from "next/navigation";
import {
  getAssetOverview,
  getCashFlowWaterfall,
  getExpenseBreakdown,
  getStatCards
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
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
  const statCards = await getStatCards(context.workspaceId);
  const assetOverview = await getAssetOverview(context.workspaceId);
  const breakdown = await getExpenseBreakdown(context.workspaceId, resolvedSearchParams?.month);
  const cashFlow = await getCashFlowWaterfall(context.workspaceId, resolvedSearchParams?.month);
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
      statCards={statCards}
      availableCategories={availableCategories}
      selectedSpendCategories={selectedSpendCategories}
      spendTop={spendTop}
    />
  );
}
