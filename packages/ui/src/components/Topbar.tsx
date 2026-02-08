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

type TopbarProps = {
  userLabel?: string;
  userInitials?: string;
  profileHref?: string;
  onToggleNumberVisibility?: () => void;
  numbersVisible?: boolean;
  workspaceSwitcher?: React.ReactNode;
  onMenuToggle?: () => void;
  viewMode?: "household" | "me";
  onToggleViewMode?: () => void;
};

export function Topbar({ userLabel, userInitials, profileHref, onToggleNumberVisibility, numbersVisible, workspaceSwitcher, onMenuToggle, viewMode, onToggleViewMode }: TopbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hideMonthControl =
    pathname.startsWith("/ledger") ||
    pathname.startsWith("/review") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/cash");
  const options = buildMonthOptions();
  const currentMonth = getMonthKey(new Date());
  const selected = searchParams.get("month") ?? currentMonth;
  const selectedIndex = options.findIndex((option) => option.value === selected);
  const previousMonth =
    selectedIndex >= 0 ? options[selectedIndex + 1] : undefined;
  const nextMonth = selectedIndex > 0 ? options[selectedIndex - 1] : undefined;

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
      <div className="topbar-header-row">
        <div className="topbar-left">
          {onMenuToggle && (
            <button
              className="menu-toggle"
              type="button"
              onClick={onMenuToggle}
              aria-label="Open menu"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          {workspaceSwitcher}
        </div>
        <div className="topbar-right">
          {onToggleViewMode && (
            <button
              className={`view-toggle${viewMode === "me" ? " view-toggle-me" : ""}`}
              type="button"
              onClick={onToggleViewMode}
              aria-label={viewMode === "me" ? "Switch to household view" : "Switch to personal view"}
              title={viewMode === "me" ? "Viewing: Me" : "Viewing: Household"}
            >
              {viewMode === "me" ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              )}
            </button>
          )}
          {onToggleNumberVisibility && (
            <button
              className="toggle-btn"
              type="button"
              onClick={onToggleNumberVisibility}
              aria-label={numbersVisible ? "Hide numbers" : "Show numbers"}
            >
              {numbersVisible ? "👁️ Hide" : "👁️‍🗨️ Show"}
            </button>
          )}
          {profileHref ? (
            <a className="topbar-avatar" href={profileHref} aria-label="User profile">
              {userInitials || (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </a>
          ) : (
            <div className="user-chip">{userLabel ?? "Signed in"}</div>
          )}
        </div>
      </div>
      {hideMonthControl ? null : (
        <div className="month-control">
          <span className="label">Month</span>
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
                const params = new URLSearchParams(searchParams.toString());
                params.set("month", previousMonth.value);
                const query = params.toString();
                router.push(query ? `${pathname}?${query}` : pathname);
              }}
            >
              {"<"}
            </button>
            <select
              className="pill-select"
              value={selected}
              onChange={handleChange}
            >
              {options.map((option) => (
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
                const params = new URLSearchParams(searchParams.toString());
                params.set("month", nextMonth.value);
                const query = params.toString();
                router.push(query ? `${pathname}?${query}` : pathname);
              }}
            >
              {">"}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
