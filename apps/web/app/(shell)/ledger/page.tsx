import { SectionHead } from "@financelab/ui";
import { redirect } from "next/navigation";
import LedgerClient from "./LedgerClient";
import LedgerFilters from "./LedgerFilters";
import {
  getCategories,
  getLedgerRows,
  getEarliestUnclosedMonth,
  type LedgerFilterParams
} from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";

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

  const ledgerRows = await getLedgerRows(context.workspaceId, {
    account: resolvedSearchParams?.account,
    category: resolvedSearchParams?.category,
    amount: resolvedSearchParams?.amount as LedgerFilterParams["amount"],
    month: resolvedSearchParams?.month,
    sort: resolvedSearchParams?.sort as LedgerFilterParams["sort"]
  });
  const categories = await getCategories(context.workspaceId);

  return (
    <>
      <SectionHead
        eyebrow="Ledger"
        title="All Transactions"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Ledger" }
        ]}
        actions={<LedgerFilters categories={categories} />}
      />
      <LedgerClient rows={ledgerRows} categories={categories} />
    </>
  );
}
