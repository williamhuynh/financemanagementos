"use client";

import type { ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MonthOption } from "../../../../lib/data";

type MonthSelectorProps = {
  options: MonthOption[];
  selected: string;
  basePath: string;
};

export default function MonthSelector({
  options,
  selected,
  basePath
}: MonthSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedIndex = options.findIndex((option) => option.value === selected);
  const previousMonth =
    selectedIndex >= 0 ? options[selectedIndex + 1] : undefined;
  const nextMonth = selectedIndex > 0 ? options[selectedIndex - 1] : undefined;

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const month = event.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (month) {
      params.set("month", month);
    } else {
      params.delete("month");
    }
    const query = params.toString();
    router.push(query ? `${basePath}?${query}` : basePath);
  };

  return (
    <div className="month-picker">
      <span className="field-label">Month</span>
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
            router.push(query ? `${basePath}?${query}` : basePath);
          }}
        >
          {"<"}
        </button>
        <select
          className="category-select"
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
            router.push(query ? `${basePath}?${query}` : basePath);
          }}
        >
          {">"}
        </button>
      </div>
    </div>
  );
}
