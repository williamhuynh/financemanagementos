"use client";

import { useMemo, useState } from "react";
import type { LedgerRow } from "../../../lib/data";

type LedgerClientProps = {
  rows: LedgerRow[];
  categories: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
const TRANSFER_CATEGORY = "Transfer";

export default function LedgerClient({ rows, categories }: LedgerClientProps) {
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    rows.forEach((row) => {
      initial[row.id] = row.category;
    });
    return initial;
  });
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [transferMap, setTransferMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    rows.forEach((row) => {
      initial[row.id] = row.isTransfer;
    });
    return initial;
  });
  const [lastCategoryMap, setLastCategoryMap] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      rows.forEach((row) => {
        initial[row.id] = row.category;
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

  if (rows.length === 0) {
    return <div className="empty-state">No ledger transactions yet.</div>;
  }

  return (
    <div className="list">
      {rows.map((row) => {
        const currentState = saveState[row.id] ?? "idle";
        const transferCurrentState = transferState[row.id] ?? "idle";
        const isTransfer = transferMap[row.id] ?? false;
        const isMatched = row.isTransferMatched;
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
                value={
                  isTransfer
                    ? TRANSFER_CATEGORY
                    : categoryMap[row.id] ?? "Uncategorised"
                }
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
                disabled={isTransfer}
              >
                {[TRANSFER_CATEGORY, ...sortedCategories]
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .map((category) => (
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
              <button
                className={`pill${isTransfer ? " active" : ""}${isMatched ? " confirmed" : ""}`}
                type="button"
                onClick={() => handleTransferToggle(row.id)}
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
              <span className={`amount ${row.tone}`}>{row.amount}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
