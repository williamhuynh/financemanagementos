"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { BottomDrawer } from "@tandemly/ui";

type LedgerFiltersProps = {
  categories: string[];
};

type AccountsResponse = {
  accounts?: string[];
};

const amountOptions = [
  { value: "any", label: "Amount: Any" },
  { value: "inflow", label: "Amount: Inflow" },
  { value: "outflow", label: "Amount: Outflow" }
];

const sortOptions = [
  { value: "asc", label: "Sort: Date (Oldest)" },
  { value: "desc", label: "Sort: Date (Newest)" }
];

type MonthOption = {
  value: string;
  label: string;
};

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric"
  }).format(date);
}

function buildMonthOptions(count = 12): MonthOption[] {
  const options: MonthOption[] = [];
  const today = new Date();
  for (let index = 0; index < count; index += 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    options.push({ value: getMonthKey(date), label: getMonthLabel(date) });
  }
  return options;
}

function updateFilter(
  pathname: string,
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  key: string,
  value: string
) {
  const next = new URLSearchParams(searchParams.toString());
  if (value === "all" || value === "any") {
    next.delete(key);
  } else {
    next.set(key, value);
  }
  const query = next.toString();
  router.push(query ? `${pathname}?${query}` : pathname);
}

export default function LedgerFilters({ categories }: LedgerFiltersProps) {
  const [accounts, setAccounts] = useState<string[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedAccount = searchParams.get("account") ?? "all";
  const selectedCategory = searchParams.get("category") ?? "all";
  const selectedAmount = searchParams.get("amount") ?? "any";
  const selectedMonth = searchParams.get("month") ?? "all";
  const selectedSort = searchParams.get("sort") ?? "asc";
  const monthOptions = useMemo(() => buildMonthOptions(), []);
  const resolvedMonthIndex =
    selectedMonth === "all"
      ? -1
      : monthOptions.findIndex((option) => option.value === selectedMonth);
  const previousMonth =
    resolvedMonthIndex >= -1
      ? monthOptions[resolvedMonthIndex + 1]
      : undefined;
  const nextMonth =
    resolvedMonthIndex > 0 ? monthOptions[resolvedMonthIndex - 1] : undefined;

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const activeFilterCount = [
    selectedAccount !== "all",
    selectedCategory !== "all",
    selectedAmount !== "any",
    selectedSort !== "asc"
  ].filter(Boolean).length;

  useEffect(() => {
    let isMounted = true;
    const loadAccounts = async () => {
      try {
        const response = await fetch("/api/accounts");
        if (!response.ok) {
          return;
        }
        const data = (await response.json()) as AccountsResponse;
        if (isMounted && Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      } catch {
        if (isMounted) {
          setAccounts([]);
        }
      }
    };
    loadAccounts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <>
      <button
        className={`filter-icon-btn${activeFilterCount > 0 ? " has-filters" : ""}`}
        type="button"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open filters"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        {activeFilterCount > 0 ? (
          <span className="filter-badge">{activeFilterCount}</span>
        ) : null}
      </button>

      <BottomDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Filters"
      >
        <p className="filter-drawer-label">Month</p>
        <div className="pill-month-control">
          <button
            className="pill-month-btn"
            type="button"
            disabled={!previousMonth}
            aria-label="Previous month"
            onClick={() => {
              if (!previousMonth) {
                return;
              }
              updateFilter(
                pathname,
                new URLSearchParams(searchParams.toString()),
                router,
                "month",
                previousMonth.value
              );
            }}
          >
            {"<"}
          </button>
          <select
            className="pill-select"
            value={selectedMonth}
            onChange={(event) =>
              updateFilter(
                pathname,
                new URLSearchParams(searchParams.toString()),
                router,
                "month",
                event.target.value
              )
            }
          >
            <option value="all">All Months</option>
            {monthOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            className="pill-month-btn"
            type="button"
            disabled={!nextMonth}
            aria-label="Next month"
            onClick={() => {
              if (!nextMonth) {
                return;
              }
              updateFilter(
                pathname,
                new URLSearchParams(searchParams.toString()),
                router,
                "month",
                nextMonth.value
              );
            }}
          >
            {">"}
          </button>
        </div>

        <p className="filter-drawer-label">Account</p>
        <select
          className="pill-select"
          value={selectedAccount}
          onChange={(event) =>
            updateFilter(
              pathname,
              new URLSearchParams(searchParams.toString()),
              router,
              "account",
              event.target.value
            )
          }
        >
          <option value="all">All Accounts</option>
          {accounts.map((account) => (
            <option key={account} value={account}>
              {account}
            </option>
          ))}
        </select>

        <p className="filter-drawer-label">Category</p>
        <select
          className="pill-select"
          value={selectedCategory}
          onChange={(event) =>
            updateFilter(
              pathname,
              new URLSearchParams(searchParams.toString()),
              router,
              "category",
              event.target.value
            )
          }
        >
          <option value="all">All Categories</option>
          {sortedCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <p className="filter-drawer-label">Amount</p>
        <select
          className="pill-select"
          value={selectedAmount}
          onChange={(event) =>
            updateFilter(
              pathname,
              new URLSearchParams(searchParams.toString()),
              router,
              "amount",
              event.target.value
            )
          }
        >
          {amountOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="filter-drawer-label">Sort</p>
        <select
          className="pill-select"
          value={selectedSort}
          onChange={(event) =>
            updateFilter(
              pathname,
              new URLSearchParams(searchParams.toString()),
              router,
              "sort",
              event.target.value
            )
          }
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </BottomDrawer>
    </>
  );
}
