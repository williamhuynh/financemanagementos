"use client";

import { useState } from "react";
import type { LedgerRow } from "../../../lib/data";
import { parseDateValue } from "../../../lib/data";

type SaveState = "idle" | "saving" | "saved" | "error";
const TRANSFER_CATEGORY = "Transfer";

type TransactionDetailProps = {
  row: LedgerRow;
  categories: string[];
  currentCategory: string;
  isTransfer: boolean;
  isTransferMatched: boolean;
  saveState: SaveState;
  transferState: SaveState;
  onCategoryChange: (category: string) => void;
  onTransferToggle: () => void;
  deleteState: SaveState;
  onDelete: () => void;
};

function formatDisplayDate(iso: string): string {
  const parsed = parseDateValue(iso);
  if (!parsed) return iso;
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function formatDirectionLabel(direction?: string): string {
  if (!direction) return "Unknown";
  return direction === "credit" ? "Credit" : "Debit";
}

export default function TransactionDetail({
  row,
  categories,
  currentCategory,
  isTransfer,
  isTransferMatched,
  saveState,
  transferState,
  onCategoryChange,
  onTransferToggle,
  deleteState,
  onDelete,
}: TransactionDetailProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const sortedCategories = [...categories].sort((a, b) => a.localeCompare(b));

  return (
    <>
      <div className="detail-panel-amount">
        <span className={`amount ${row.tone}`}>{row.amount}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Description</span>
        <span className="right-drawer-value">{row.title}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Date</span>
        <span className="right-drawer-value">
          {row.date ? formatDisplayDate(row.date) : "Unknown"}
        </span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Account</span>
        <span className="right-drawer-value">{row.account ?? "Unassigned"}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Direction</span>
        <span className="right-drawer-value">
          {formatDirectionLabel(row.direction)}
        </span>
      </div>

      {row.sourceOwner && (
        <div className="right-drawer-detail">
          <span className="right-drawer-label">Owner</span>
          <span className="right-drawer-value">{row.sourceOwner}</span>
        </div>
      )}

      {row.sourceAccount && (
        <div className="right-drawer-detail">
          <span className="right-drawer-label">Source Account</span>
          <span className="right-drawer-value">{row.sourceAccount}</span>
        </div>
      )}

      {row.notes && (
        <div className="right-drawer-detail">
          <span className="right-drawer-label">Notes</span>
          <span className="right-drawer-value">{row.notes}</span>
        </div>
      )}

      <div className="right-drawer-actions">
        <div className="right-drawer-detail">
          <span className="right-drawer-label">Category</span>
          <select
            className="category-select"
            value={isTransfer ? TRANSFER_CATEGORY : currentCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            disabled={isTransfer || saveState === "saving"}
          >
            {[TRANSFER_CATEGORY, ...sortedCategories]
              .filter((value, index, array) => array.indexOf(value) === index)
              .map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
          </select>
        </div>
        <button
          className={`pill${isTransfer ? " active" : ""}${isTransferMatched ? " confirmed" : ""}`}
          type="button"
          onClick={onTransferToggle}
          disabled={
            transferState === "saving" || (isTransfer && isTransferMatched)
          }
        >
          {transferState === "saving"
            ? "Saving..."
            : transferState === "error"
              ? "Retry"
              : isTransfer && isTransferMatched
                ? "Transfer \u2713"
                : isTransfer
                  ? "Transfer"
                  : "Mark transfer"}
        </button>
      </div>

      <div className="right-drawer-delete">
        {!showConfirm ? (
          <button
            className="btn-delete"
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={deleteState === "saving"}
          >
            Delete Transaction
          </button>
        ) : (
          <div className="delete-confirm">
            <p className="delete-confirm-text">
              Are you sure? This cannot be undone.
            </p>
            <div className="delete-confirm-actions">
              <button
                className="btn-delete-confirm"
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  onDelete();
                }}
                disabled={deleteState === "saving"}
              >
                {deleteState === "saving" ? "Deleting..." : "Yes, delete"}
              </button>
              <button
                className="btn-delete-cancel"
                type="button"
                onClick={() => setShowConfirm(false)}
                disabled={deleteState === "saving"}
              >
                Cancel
              </button>
            </div>
            {deleteState === "error" && (
              <p className="delete-error">Failed to delete. Please try again.</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
