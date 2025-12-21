"use client";

import { useMemo, useState } from "react";
import type { LedgerRow } from "../../../lib/data";

type LedgerClientProps = {
  rows: LedgerRow[];
  categories: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function LedgerClient({ rows, categories }: LedgerClientProps) {
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    rows.forEach((row) => {
      initial[row.id] = row.category;
    });
    return initial;
  });
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const handleSave = async (id: string) => {
    setSaveState((prev) => ({ ...prev, [id]: "saving" }));
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: categoryMap[id] })
      });
      if (!response.ok) {
        throw new Error("Update failed");
      }
      setSaveState((prev) => ({ ...prev, [id]: "saved" }));
    } catch (error) {
      setSaveState((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  return (
    <div className="list">
      {rows.map((row) => {
        const currentState = saveState[row.id] ?? "idle";
        return (
          <div
            key={row.id}
            className={row.highlight ? "list-row highlight" : "list-row"}
          >
            <div>
              <div className="row-title">{row.title}</div>
              <div className="row-sub">{row.sub}</div>
            </div>
            <div className="row-meta row-meta-edit">
              <select
                className="category-select"
                value={categoryMap[row.id] ?? "Uncategorised"}
                onChange={(event) =>
                  {
                    const nextValue = event.target.value;
                    setCategoryMap((prev) => ({
                      ...prev,
                      [row.id]: nextValue
                    }));
                    setSaveState((prev) => ({ ...prev, [row.id]: "idle" }));
                  }
                }
              >
                {sortedCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                className="pill"
                type="button"
                onClick={() => handleSave(row.id)}
                disabled={currentState === "saving"}
              >
                {currentState === "saving"
                  ? "Saving..."
                  : currentState === "saved"
                  ? "Saved"
                  : currentState === "error"
                  ? "Retry"
                  : "Update"}
              </button>
              <span className={`amount ${row.tone}`}>{row.amount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
