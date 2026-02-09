"use client";

import { useMemo, useState } from "react";
import type { ReviewItem } from "../../../lib/data";

type ReviewClientProps = {
  items: ReviewItem[];
  categories: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
const TRANSFER_CATEGORY = "Transfer";

export default function ReviewClient({ items, categories }: ReviewClientProps) {
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    items.forEach((item) => {
      initial[item.id] = item.category;
    });
    return initial;
  });
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [transferMap, setTransferMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    items.forEach((item) => {
      initial[item.id] = item.isTransfer;
    });
    return initial;
  });
  const [lastCategoryMap, setLastCategoryMap] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      items.forEach((item) => {
        initial[item.id] = item.category;
      });
      return initial;
    }
  );
  const [transferState, setTransferState] = useState<Record<string, SaveState>>(
    {}
  );

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const handleSave = async (id: string, category: string) => {
    setSaveState((prev) => ({ ...prev, [id]: "saving" }));
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category })
      });
      if (!response.ok) {
        throw new Error("Update failed");
      }
      setSaveState((prev) => ({ ...prev, [id]: "saved" }));
    } catch (error) {
      setSaveState((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  const handleTransferToggle = async (id: string) => {
    const nextValue = !transferMap[id];
    const nextCategory = nextValue
      ? TRANSFER_CATEGORY
      : lastCategoryMap[id] ?? "Uncategorised";
    if (nextValue) {
      setLastCategoryMap((prev) => ({
        ...prev,
        [id]: categoryMap[id] ?? "Uncategorised"
      }));
    }
    setTransferMap((prev) => ({ ...prev, [id]: nextValue }));
    setCategoryMap((prev) => ({ ...prev, [id]: nextCategory }));
    setTransferState((prev) => ({ ...prev, [id]: "saving" }));
    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          is_transfer: nextValue,
          category: nextCategory
        })
      });
      if (!response.ok) {
        throw new Error("Update failed");
      }
      setTransferState((prev) => ({ ...prev, [id]: "idle" }));
    } catch (error) {
      setTransferMap((prev) => ({ ...prev, [id]: !nextValue }));
      setCategoryMap((prev) => ({
        ...prev,
        [id]: nextValue
          ? categoryMap[id] ?? "Uncategorised"
          : TRANSFER_CATEGORY
      }));
      setTransferState((prev) => ({ ...prev, [id]: "error" }));
    }
  };

  if (items.length === 0) {
    return <div className="empty-state">No items to review.</div>;
  }

  return (
    <div className="review-grid">
      {items.map((item) => {
        const currentState = saveState[item.id] ?? "idle";
        const transferCurrentState = transferState[item.id] ?? "idle";
        const isTransfer = transferMap[item.id] ?? false;
        const isMatched = item.isTransferMatched;
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
                value={
                  isTransfer
                    ? TRANSFER_CATEGORY
                    : categoryMap[item.id] ?? "Uncategorised"
                }
                onChange={(event) =>
                  {
                    const nextValue = event.target.value;
                    setCategoryMap((prev) => ({
                      ...prev,
                      [item.id]: nextValue
                    }));
                    handleSave(item.id, nextValue);
                  }
                }
                disabled={isTransfer || currentState === "saving"}
              >
                {[TRANSFER_CATEGORY, ...sortedCategories]
                  .filter(
                    (value, index, array) => array.indexOf(value) === index
                  )
                  .map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <button
                className={`pill${isTransfer ? " active" : ""}${
                  isMatched ? " confirmed" : ""
                }`}
                type="button"
                onClick={() => handleTransferToggle(item.id)}
                disabled={
                  transferCurrentState === "saving" ||
                  (isTransfer && isMatched)
                }
              >
                {transferCurrentState === "saving"
                  ? "Saving..."
                  : transferCurrentState === "error"
                  ? "Retry"
                  : isTransfer && isMatched
                  ? "Transfer ✓"
                  : isTransfer
                  ? "Transfer"
                  : "Mark transfer"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
