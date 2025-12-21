import { SectionHead } from "@financelab/ui";
import LedgerClient from "./LedgerClient";
import { getCategories, getLedgerRows } from "../../../lib/data";

export default async function LedgerPage() {
  const ledgerRows = await getLedgerRows();
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
        actions={
          <>
            <button className="pill" type="button">
              Account: All
            </button>
            <button className="pill" type="button">
              Category: All
            </button>
            <button className="pill" type="button">
              Amount: Any
            </button>
          </>
        }
      />
      <LedgerClient rows={ledgerRows} categories={categories} />
    </>
  );
}
