"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

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
      } catch (error) {
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
          <option value="all">Month: All</option>
          {monthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {`Month: ${option.label}`}
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
        <option value="all">Account: All</option>
        {accounts.map((account) => (
          <option key={account} value={account}>
            {`Account: ${account}`}
          </option>
        ))}
      </select>
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
        <option value="all">Category: All</option>
        {sortedCategories.map((category) => (
          <option key={category} value={category}>
            {`Category: ${category}`}
          </option>
        ))}
      </select>
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
    </>
  );
}
