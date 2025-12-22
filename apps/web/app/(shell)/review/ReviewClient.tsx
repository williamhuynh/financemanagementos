"use client";

import { useMemo, useState } from "react";
import type { ReviewItem } from "../../../lib/data";

type ReviewClientProps = {
  items: ReviewItem[];
  categories: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ReviewClient({ items, categories }: ReviewClientProps) {
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.id] = item.category;
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

  if (items.length === 0) {
    return <div className="empty-state">No items to review.</div>;
  }

  return (
    <div className="review-grid">
      {items.map((item) => {
        const currentState = saveState[item.id] ?? "idle";
        const amountTone = item.amount.trim().startsWith("-")
          ? "negative"
          : "positive";
        return (
          <article key={item.id} className="card review-card">
            <div className="row-title">{item.title}</div>
            <div className="row-sub">{item.sub}</div>
            <div className={`amount ${amountTone}`}>{item.amount}</div>
            <div className="review-actions">
              <select
                className="category-select"
                value={categoryMap[item.id] ?? "Uncategorised"}
                onChange={(event) =>
                  {
                    const nextValue = event.target.value;
                    setCategoryMap((prev) => ({
                      ...prev,
                      [item.id]: nextValue
                    }));
                    setSaveState((prev) => ({ ...prev, [item.id]: "idle" }));
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
                onClick={() => handleSave(item.id)}
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
            </div>
            <div className="review-tags">
              {item.actions.map((action) => (
                <span key={action} className="meta-pill">
                  {action}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}
