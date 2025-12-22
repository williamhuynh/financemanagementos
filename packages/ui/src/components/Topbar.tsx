"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

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

export function Topbar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const options = buildMonthOptions();
  const currentMonth = getMonthKey(new Date());
  const selected = searchParams.get("month") ?? currentMonth;

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const month = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (month) {
      params.set("month", month);
    } else {
      params.delete("month");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <header className="topbar">
      <div className="month-control">
        <span className="label">Month</span>
        <select className="pill-select" value={selected} onChange={handleChange}>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="topbar-actions">
        <div className="search">
          <input type="search" placeholder="Search merchants, categories, accounts" />
        </div>
        <button className="ghost-btn" type="button">
          Export
        </button>
        <button className="primary-btn" type="button">
          Import
        </button>
        <div className="user-chip">William + Peggy</div>
      </div>
    </header>
  );
}
