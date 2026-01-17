import {
  getAssetOverview,
  getCashFlowWaterfall,
  getExpenseBreakdown,
  getStatCards
} from "../../../lib/data";
import DashboardClient from "./DashboardClient";

type DashboardPageProps = {
  searchParams?: Promise<{
    month?: string;
    spendTop?: string;
    spendCategories?: string;
  }>;
};

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
