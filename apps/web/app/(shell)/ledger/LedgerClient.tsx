"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DetailPanel } from "@tandemly/ui";
import type { LedgerRow } from "../../../lib/data";
import { useView } from "../../../lib/view-context";
import TransactionDetail from "./TransactionDetail";

type LedgerClientProps = {
  rows: LedgerRow[];
  categories: string[];
};

type SaveState = "idle" | "saving" | "saved" | "error";
const TRANSFER_CATEGORY = "Transfer";
const PAGE_SIZE = 50;

function getOwnerBadgeLabel(owner?: string): string {
  if (!owner || owner === "Joint") return "J";
  const parts = owner.trim().split(/\s+/);
  return (
    (parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "")
  ).toUpperCase() || owner.charAt(0).toUpperCase();
}

export default function LedgerClient({ rows, categories }: LedgerClientProps) {
  const searchParams = useSearchParams();
  const { isVisibleOwner } = useView();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<LedgerRow[]>(rows);
  const [offset, setOffset] = useState(rows.length);
  const [hasMore, setHasMore] = useState(rows.length >= PAGE_SIZE);
  const [isLoading, setIsLoading] = useState(false);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});
  const [transferMap, setTransferMap] = useState<Record<string, boolean>>({});
  const [lastCategoryMap, setLastCategoryMap] = useState<Record<string, string>>(
    {}
  );
  const [transferState, setTransferState] = useState<Record<string, SaveState>>(
    {}
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sortedCategories = useMemo(() => {
    return [...categories].sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const filters = useMemo(() => {
    return {
      account: searchParams.get("account") ?? "all",
      category: searchParams.get("category") ?? "all",
      amount: searchParams.get("amount") ?? "any",
      month: searchParams.get("month") ?? "all",
      sort: searchParams.get("sort") ?? "asc"
    };
  }, [searchParams]);

  const mergeRowState = useCallback((rowsToMerge: LedgerRow[]) => {
    setCategoryMap((prev) => {
      const next = { ...prev };
      rowsToMerge.forEach((row) => {
        if (!(row.id in next)) {
          next[row.id] = row.category;
        }
      });
      return next;
    });
    setTransferMap((prev) => {
      const next = { ...prev };
      rowsToMerge.forEach((row) => {
        if (!(row.id in next)) {
          next[row.id] = row.isTransfer;
        }
      });
      return next;
    });
    setLastCategoryMap((prev) => {
      const next = { ...prev };
      rowsToMerge.forEach((row) => {
        if (!(row.id in next)) {
          next[row.id] = row.category;
        }
      });
      return next;
    });
  }, []);

  useEffect(() => {
    const nextCategoryMap: Record<string, string> = {};
    const nextTransferMap: Record<string, boolean> = {};
    const nextLastCategoryMap: Record<string, string> = {};
    rows.forEach((row) => {
      nextCategoryMap[row.id] = row.category;
      nextTransferMap[row.id] = row.isTransfer;
      nextLastCategoryMap[row.id] = row.category;
    });
    setItems(rows);
    setOffset(rows.length);
    setHasMore(rows.length >= PAGE_SIZE);
    setIsLoading(false);
    setSaveState({});
    setTransferState({});
    setCategoryMap(nextCategoryMap);
    setTransferMap(nextTransferMap);
    setLastCategoryMap(nextLastCategoryMap);
    setSelectedId(null);
  }, [rows]);

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) {
      return;
    }
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("offset", String(offset));
      params.set("limit", String(PAGE_SIZE));
      if (filters.account !== "all") {
        params.set("account", filters.account);
      }
      if (filters.category !== "all") {
        params.set("category", filters.category);
      }
      if (filters.amount !== "any") {
        params.set("amount", filters.amount);
      }
      if (filters.month !== "all") {
        params.set("month", filters.month);
      }
      if (filters.sort) {
        params.set("sort", filters.sort);
      }
      const response = await fetch(`/api/ledger?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Failed to load ledger rows.");
      }
      const payload = (await response.json()) as {
        items?: LedgerRow[];
        hasMore?: boolean;
      };
      const nextRows = payload.items ?? [];
      setItems((prev) =>
        offset === 0 ? nextRows : [...prev, ...nextRows]
      );
      setOffset((prev) => prev + nextRows.length);
      setHasMore(Boolean(payload.hasMore));
      mergeRowState(nextRows);
    } catch (error) {
      setHasMore(false);
    } finally {
      setIsLoading(false);
    }
  }, [filters, hasMore, isLoading, mergeRowState, offset]);

  useEffect(() => {
    if (!loadMoreRef.current) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          void loadMore();
        }
      },
      { rootMargin: "240px" }
    );
    observer.observe(loadMoreRef.current);
    return () => {
      observer.disconnect();
    };
  }, [loadMore]);

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

  const handleRowClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleRowKeyDown = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleRowClick(id);
      }
    },
    [handleRowClick]
  );

  const visibleItems = useMemo(() => {
    return items.filter((row) => isVisibleOwner(row.sourceOwner ?? ""));
  }, [items, isVisibleOwner]);

  const selectedRow = useMemo(() => {
    if (!selectedId) return null;
    return visibleItems.find((r) => r.id === selectedId) ?? null;
  }, [selectedId, visibleItems]);

  if (visibleItems.length === 0 && !isLoading) {
    return <div className="empty-state">No transactions yet.</div>;
  }

  return (
    <div className="ledger-layout">
      <div className="ledger-content">
        <div className="list">
          {visibleItems.map((row) => {
            const currentState = saveState[row.id] ?? "idle";
            const transferCurrentState = transferState[row.id] ?? "idle";
            const isTransfer = transferMap[row.id] ?? false;
            const isMatched = row.isTransferMatched;
            const isSelected = selectedId === row.id;
            return (
              <div
                key={row.id}
                className={
                  `list-row${row.highlight ? " highlight" : ""}${isSelected ? " selected" : ""}`
                }
                onClick={() => handleRowClick(row.id)}
                onKeyDown={(e) => handleRowKeyDown(e, row.id)}
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
              >
                <div>
                  <div className="row-title">
                    {row.title}
                    {row.sourceOwner && (
                      <span
                        className={`owner-badge${!row.sourceOwner || row.sourceOwner === "Joint" ? " owner-badge-joint" : ""}`}
                        title={row.sourceOwner === "Joint" ? "Joint" : row.sourceOwner}
                        style={{ marginLeft: 8 }}
                      >
                        {getOwnerBadgeLabel(row.sourceOwner)}
                      </span>
                    )}
                  </div>
                  <div className="row-sub">{row.sub}</div>
                </div>
                <div
                  className="row-meta row-meta-edit"
                  onClick={(e) => e.stopPropagation()}
                >
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
                        handleSave(row.id, nextValue);
                      }
                    }
                    disabled={isTransfer || currentState === "saving"}
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
          {isLoading ? (
            <div className="empty-state">Loading more transactions...</div>
          ) : null}
          <div ref={loadMoreRef} />
        </div>
      </div>
      <DetailPanel
        open={!!selectedRow}
        onClose={() => setSelectedId(null)}
        title="Transaction Details"
      >
        {selectedRow ? (
          <TransactionDetail
            row={selectedRow}
            categories={sortedCategories}
            currentCategory={categoryMap[selectedRow.id] ?? "Uncategorised"}
            isTransfer={transferMap[selectedRow.id] ?? false}
            isTransferMatched={selectedRow.isTransferMatched}
            saveState={saveState[selectedRow.id] ?? "idle"}
            transferState={transferState[selectedRow.id] ?? "idle"}
            onCategoryChange={(value) => {
              setCategoryMap((prev) => ({
                ...prev,
                [selectedRow.id]: value
              }));
              handleSave(selectedRow.id, value);
            }}
            onTransferToggle={() => handleTransferToggle(selectedRow.id)}
          />
        ) : null}
      </DetailPanel>
    </div>
  );
}
