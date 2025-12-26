"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SpendByCategoryControlsProps = {
  categories: string[];
  selectedCategories: string[];
  topCount: number;
};

export default function SpendByCategoryControls({
  categories,
  selectedCategories,
  topCount
}: SpendByCategoryControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.localeCompare(b)),
    [categories]
  );
  const selectedSet = useMemo(
    () => new Set(selectedCategories),
    [selectedCategories]
  );
  const topCountBase = selectedCategories.length || sortedCategories.length;
  const maxTop = Math.max(1, Math.min(6, topCountBase));
  const normalizedTop =
    Number.isFinite(topCount) && topCount > 0
      ? Math.min(topCount, maxTop)
      : 3;
  const topOptions = Array.from({ length: maxTop }, (_, index) => index + 1);

  const updateSearch = (nextCategories: string[], nextTop: number) => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("spendTop", String(nextTop));
    next.set("spendCategories", nextCategories.join(","));
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const handleToggleCategory = (category: string) => {
    const next = new Set(selectedSet);
    if (next.has(category)) {
      next.delete(category);
    } else {
      next.add(category);
    }
    updateSearch(Array.from(next), normalizedTop);
  };

  const handleTopChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextTop = Number(event.target.value);
    updateSearch(selectedCategories, Number.isFinite(nextTop) ? nextTop : 3);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <>
      <button className="pill" type="button" onClick={() => setIsOpen(true)}>
        Spend filters
      </button>
      {isOpen && isMounted
        ? createPortal(
            <div className="spend-filter-modal" role="dialog" aria-modal="true">
              <button
                className="spend-filter-backdrop"
                type="button"
                aria-label="Close spend filters"
                onClick={() => setIsOpen(false)}
              />
              <div className="spend-filter-panel">
                <div className="spend-filter-head">
                  <div>
                    <div className="card-title">Spend filters</div>
                    <div className="card-sub">
                      Choose categories and top count.
                    </div>
                  </div>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setIsOpen(false)}
                  >
                    Close
                  </button>
                </div>
                <div className="field">
                  <label className="field-label" htmlFor="spend-top-count">
                    Top categories
                  </label>
                  <select
                    id="spend-top-count"
                    className="field-input"
                    value={normalizedTop}
                    onChange={handleTopChange}
                  >
                    {topOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <div className="field-label">Include categories</div>
                  <div className="spend-filter-grid">
                    {sortedCategories.map((category) => (
                      <label key={category} className="spend-filter-option">
                        <input
                          type="checkbox"
                          checked={selectedSet.has(category)}
                          onChange={() => handleToggleCategory(category)}
                        />
                        <span>{category}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
