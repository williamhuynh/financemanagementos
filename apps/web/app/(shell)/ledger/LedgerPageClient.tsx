"use client";

import { useState } from "react";
import { SectionHead } from "@tandemly/ui";
import LedgerFilters from "./LedgerFilters";
import LedgerClient from "./LedgerClient";
import type { LedgerRow } from "../../../lib/data";

type LedgerPageClientProps = {
  rows: LedgerRow[];
  categories: string[];
  defaultCurrency: string;
};

export default function LedgerPageClient({ rows, categories, defaultCurrency }: LedgerPageClientProps) {
  const [showNewForm, setShowNewForm] = useState(false);

  return (
    <>
      <SectionHead
        title="All Transactions"
        actions={
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="icon-btn"
              onClick={() => setShowNewForm(true)}
              title="Add transaction"
              aria-label="Add transaction"
            >
              +
            </button>
            <LedgerFilters categories={categories} />
          </div>
        }
      />
      <LedgerClient
        rows={rows}
        categories={categories}
        defaultCurrency={defaultCurrency}
        showNewForm={showNewForm}
        onCloseNewForm={() => setShowNewForm(false)}
      />
    </>
  );
}
