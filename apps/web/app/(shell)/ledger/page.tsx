import { SectionHead } from "@financelab/ui";
import LedgerClient from "./LedgerClient";
import LedgerFilters from "./LedgerFilters";
import {
  getCategories,
  getLedgerRows,
  type LedgerFilterParams
} from "../../../lib/data";

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
  const resolvedSearchParams = await searchParams;
  const ledgerRows = await getLedgerRows({
    account: resolvedSearchParams?.account,
    category: resolvedSearchParams?.category,
    amount: resolvedSearchParams?.amount as LedgerFilterParams["amount"],
    month: resolvedSearchParams?.month,
    sort: resolvedSearchParams?.sort as LedgerFilterParams["sort"]
  });
  const categories = await getCategories();

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
