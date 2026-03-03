import { redirect } from "next/navigation";
import LedgerPageClient from "./LedgerPageClient";
import {
  getCategories,
  getLedgerRows,
  getEarliestUnclosedMonth,
  type LedgerFilterParams
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";

type LedgerSearchParams = {
  account?: string;
  category?: string;
  amount?: string;
  month?: string;
  sort?: string;
};

type LedgerPageProps = {
  searchParams?: Promise<LedgerSearchParams>;
};

export default async function LedgerPage({ searchParams }: LedgerPageProps) {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;

  // If no month is specified, redirect to the earliest unclosed month
  if (!resolvedSearchParams?.month) {
    const earliestUnclosedMonth = await getEarliestUnclosedMonth(context.workspaceId);
    if (earliestUnclosedMonth) {
      const params = new URLSearchParams();
      params.set("month", earliestUnclosedMonth);

      // Preserve other query parameters
      if (resolvedSearchParams?.account) {
        params.set("account", resolvedSearchParams.account);
      }
      if (resolvedSearchParams?.category) {
        params.set("category", resolvedSearchParams.category);
      }
      if (resolvedSearchParams?.amount) {
        params.set("amount", resolvedSearchParams.amount);
      }
      if (resolvedSearchParams?.sort) {
        params.set("sort", resolvedSearchParams.sort);
      }

      redirect(`/ledger?${params.toString()}`);
    }
  }

  // Fetch ledger data, categories, and workspace in parallel
  const [ledgerRows, categories, workspace] = await Promise.all([
    getLedgerRows(context.workspaceId, {
      account: resolvedSearchParams?.account,
      category: resolvedSearchParams?.category,
      amount: resolvedSearchParams?.amount as LedgerFilterParams["amount"],
      month: resolvedSearchParams?.month,
      sort: resolvedSearchParams?.sort as LedgerFilterParams["sort"]
    }),
    getCategories(context.workspaceId),
    getWorkspaceById(context.workspaceId),
  ]);

  const defaultCurrency = workspace?.currency || "AUD";

  return (
    <LedgerPageClient
      rows={ledgerRows}
      categories={categories}
      defaultCurrency={defaultCurrency}
    />
  );
}
