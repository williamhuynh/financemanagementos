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
    <label className="month-picker">
      <span className="field-label">Month</span>
      <select className="category-select" value={selected} onChange={handleChange}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
