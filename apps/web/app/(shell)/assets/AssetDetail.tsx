"use client";

import { useEffect, useState } from "react";
import type { AssetItem, AssetCategorySummary, AssetHistoryEntry } from "../../../lib/data";
import { maskCurrencyValue } from "../../../lib/data";
import { SUPPORTED_CURRENCIES } from "../../../lib/currencies";

type SaveState = "idle" | "saving" | "saved" | "error";

type AssetDetailViewProps = {
  mode: "view";
  asset: AssetItem;
  categories: AssetCategorySummary[];
  ownerOptions: string[];
  homeCurrency: string;
  historyEntries: AssetHistoryEntry[];
  isVisible: boolean;
  onSave: (id: string, data: { name: string; type: string; owner: string; currency: string }) => Promise<void>;
  onDispose: (asset: AssetItem) => Promise<void>;
  onDelete: (asset: AssetItem) => void;
  onSaveValue: (data: { assetId: string; assetName: string; assetType: string; value: number; currency: string; recordedAt: string; source: string; notes?: string }) => Promise<void>;
  onDeleteValue: (entryId: string) => void;
  saveState: SaveState;
  saveError: string;
  valueState: SaveState;
  valueError: string;
  deleteState: SaveState;
};

type AssetDetailAddProps = {
  mode: "add";
  categories: AssetCategorySummary[];
  ownerOptions: string[];
  homeCurrency: string;
  initialType: string;
  onCreateAsset: (data: { name: string; type: string; owner: string; currency: string }) => Promise<void>;
  saveState: SaveState;
  saveError: string;
};

type AssetDetailProps = AssetDetailViewProps | AssetDetailAddProps;

function formatLocalDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function getMonthEndDate(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth();
  return new Date(year, month + 1, 0, 23, 59);
}

function formatCurrencyInput(value: string) {
  if (!value) return "";
  const numericValue = value.replace(/[^0-9.]/g, "");
  if (!numericValue) return "";
  const parts = numericValue.split(".");
  const dollars = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = parts[1] !== undefined ? "." + parts[1].slice(0, 2) : "";
  return "$" + dollars + cents;
}

function parseCurrencyInput(value: string) {
  return value.replace(/[^0-9.]/g, "");
}

function formatValueWithHomeMasked(
  value: string,
  homeValue: string,
  currency: string,
  homeCurrency: string,
  isVisible: boolean
) {
  const maskedValue = maskCurrencyValue(value, isVisible);
  if (!currency || currency.toUpperCase() === homeCurrency.toUpperCase()) {
    return maskedValue;
  }
  const maskedHomeValue = maskCurrencyValue(homeValue, isVisible);
  return `${maskedValue} (${maskedHomeValue})`;
}

export default function AssetDetail(props: AssetDetailProps) {
  if (props.mode === "add") {
    return <AssetDetailAdd {...props} />;
  }
  return <AssetDetailView {...props} />;
}

function AssetDetailAdd({
  categories,
  ownerOptions,
  homeCurrency,
  initialType,
  onCreateAsset,
  saveState,
  saveError,
}: AssetDetailAddProps) {
  const [form, setForm] = useState({
    name: "",
    type: initialType,
    owner: "Joint",
    currency: homeCurrency,
  });

  useEffect(() => {
    setForm({
      name: "",
      type: initialType,
      owner: "Joint",
      currency: homeCurrency,
    });
  }, [initialType, homeCurrency]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onCreateAsset({
      name: form.name.trim(),
      type: form.type,
      owner: form.owner,
      currency: form.currency.trim() || homeCurrency,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="right-drawer-actions">
        <div className="field">
          <label className="field-label" htmlFor="add-asset-name">
            Asset name
          </label>
          <input
            id="add-asset-name"
            className="field-input"
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="CMC Portfolio"
            autoFocus
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="add-asset-type">
            Category
          </label>
          <select
            id="add-asset-type"
            className="field-input"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
          >
            {categories.map((cat) => (
              <option key={cat.type} value={cat.type}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="add-asset-owner">
            Owner
          </label>
          <select
            id="add-asset-owner"
            className="field-input"
            value={form.owner}
            onChange={(e) => setForm((prev) => ({ ...prev, owner: e.target.value }))}
          >
            {ownerOptions.map((owner) => (
              <option key={owner} value={owner}>
                {owner}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="add-asset-currency">
            Currency
          </label>
          <select
            id="add-asset-currency"
            className="field-input"
            value={form.currency}
            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
          >
            {SUPPORTED_CURRENCIES.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
        <div className="review-actions">
          <button
            className="primary-btn"
            type="submit"
            disabled={saveState === "saving" || !form.name.trim()}
          >
            {saveState === "saving" ? "Saving..." : "Save asset"}
          </button>
          {saveState === "saved" ? <span className="chip">Saved</span> : null}
          {saveState === "error" ? (
            <span className="chip warn">Check details</span>
          ) : null}
          {saveError ? (
            <span className="asset-note">{saveError}</span>
          ) : null}
        </div>
      </div>
    </form>
  );
}

function AssetDetailView({
  asset,
  categories,
  ownerOptions,
  homeCurrency,
  historyEntries,
  isVisible,
  onSave,
  onDispose,
  onDelete,
  onSaveValue,
  onDeleteValue,
  saveState,
  saveError,
  valueState,
  valueError,
  deleteState,
}: AssetDetailViewProps) {
  const isDisposed = asset.status === "disposed";

  const [editForm, setEditForm] = useState({
    name: asset.name,
    type: asset.type,
    owner: asset.owner,
    currency: asset.currency,
  });

  const [valueForm, setValueForm] = useState({
    recordedAt: formatLocalDateTime(new Date()),
    useMonthEnd: false,
    source: "manual",
    value: "",
    notes: "",
  });

  const [showConfirm, setShowConfirm] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);

  useEffect(() => {
    setEditForm({
      name: asset.name,
      type: asset.type,
      owner: asset.owner,
      currency: asset.currency,
    });
    setShowConfirm(false);
    setHistoryExpanded(false);
    setValueForm({
      recordedAt: formatLocalDateTime(new Date()),
      useMonthEnd: false,
      source: "manual",
      value: "",
      notes: "",
    });
  }, [asset.id]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim()) return;
    onSave(asset.id, {
      name: editForm.name.trim(),
      type: editForm.type,
      owner: editForm.owner,
      currency: editForm.currency.trim() || homeCurrency,
    });
  };

  const handleRecordedAtChange = (nextValue: string) => {
    if (valueForm.useMonthEnd) {
      const parsed = new Date(nextValue);
      if (!Number.isNaN(parsed.valueOf())) {
        setValueForm((prev) => ({
          ...prev,
          recordedAt: formatLocalDateTime(getMonthEndDate(parsed)),
        }));
        return;
      }
    }
    setValueForm((prev) => ({ ...prev, recordedAt: nextValue }));
  };

  const handleMonthEndToggle = (checked: boolean) => {
    setValueForm((prev) => {
      const next = { ...prev, useMonthEnd: checked };
      if (checked) {
        const base = prev.recordedAt ? new Date(prev.recordedAt) : new Date();
        if (!Number.isNaN(base.valueOf())) {
          next.recordedAt = formatLocalDateTime(getMonthEndDate(base));
        }
      }
      return next;
    });
  };

  const handleValueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericValue = Number(parseCurrencyInput(valueForm.value));
    if (!Number.isFinite(numericValue) || !valueForm.value) return;
    onSaveValue({
      assetId: asset.id,
      assetName: asset.name,
      assetType: asset.type,
      value: numericValue,
      currency: asset.currency,
      recordedAt: valueForm.recordedAt
        ? new Date(valueForm.recordedAt).toISOString()
        : new Date().toISOString(),
      source: valueForm.source.trim() || "manual",
      notes: valueForm.notes.trim() || undefined,
    });
  };

  const visibleEntries = historyExpanded
    ? historyEntries
    : historyEntries.slice(0, 3);

  return (
    <>
      {/* Hero value */}
      <div className="detail-panel-amount">
        <span className="amount">
          {formatValueWithHomeMasked(
            asset.formattedValue,
            asset.formattedAudValue,
            asset.currency,
            homeCurrency,
            isVisible
          )}
        </span>
      </div>

      {/* Read-only fields */}
      <div className="right-drawer-detail">
        <span className="right-drawer-label">Status</span>
        <span className="right-drawer-value">
          {isDisposed ? "Disposed" : "Active"}
        </span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Last updated</span>
        <span className="right-drawer-value">{asset.lastUpdatedLabel}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Category</span>
        <span className="right-drawer-value">{asset.typeLabel}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Owner</span>
        <span className="right-drawer-value">{asset.owner || "Joint"}</span>
      </div>

      <div className="right-drawer-detail">
        <span className="right-drawer-label">Currency</span>
        <span className="right-drawer-value">{asset.currency}</span>
      </div>

      {/* Edit fields (hidden when disposed) */}
      {!isDisposed && (
        <form onSubmit={handleEditSubmit}>
          <div className="right-drawer-actions">
            <div className="field">
              <label className="field-label" htmlFor="edit-asset-name">
                Asset name
              </label>
              <input
                id="edit-asset-name"
                className="field-input"
                type="text"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="CMC Portfolio"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-asset-type">
                Category
              </label>
              <select
                id="edit-asset-type"
                className="field-input"
                value={editForm.type}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, type: e.target.value }))
                }
              >
                {categories.map((cat) => (
                  <option key={cat.type} value={cat.type}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-asset-owner">
                Owner
              </label>
              <select
                id="edit-asset-owner"
                className="field-input"
                value={editForm.owner}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, owner: e.target.value }))
                }
              >
                {ownerOptions.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="edit-asset-currency">
                Currency
              </label>
              <select
                id="edit-asset-currency"
                className="field-input"
                value={editForm.currency}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, currency: e.target.value }))
                }
              >
                {SUPPORTED_CURRENCIES.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </div>
            <div className="review-actions">
              <button
                className="primary-btn"
                type="submit"
                disabled={saveState === "saving" || !editForm.name.trim()}
              >
                {saveState === "saving" ? "Saving..." : "Save changes"}
              </button>
              {saveState === "saved" ? <span className="chip">Saved</span> : null}
              {saveState === "error" ? (
                <span className="chip warn">Check details</span>
              ) : null}
              {saveError ? (
                <span className="asset-note">{saveError}</span>
              ) : null}
            </div>
          </div>
        </form>
      )}

      {/* Update value section (hidden when disposed) */}
      {!isDisposed && (
        <form onSubmit={handleValueSubmit}>
          <div className="right-drawer-actions">
            <div className="right-drawer-detail">
              <span className="right-drawer-label" style={{ fontWeight: 600 }}>
                Update value
              </span>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="panel-recorded-at">
                Recorded at
              </label>
              <input
                id="panel-recorded-at"
                className="field-input"
                type="datetime-local"
                value={valueForm.recordedAt}
                onChange={(e) => handleRecordedAtChange(e.target.value)}
                onFocus={(e) => e.target.select()}
              />
            </div>
            <div className="field asset-toggle">
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={valueForm.useMonthEnd}
                  onChange={(e) => handleMonthEndToggle(e.target.checked)}
                />
                <span>Snap to month-end</span>
              </label>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="panel-source">
                Source
              </label>
              <input
                id="panel-source"
                className="field-input"
                type="text"
                value={valueForm.source}
                onChange={(e) =>
                  setValueForm((prev) => ({ ...prev, source: e.target.value }))
                }
                onFocus={(e) => e.target.select()}
                placeholder="manual"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="panel-value">
                Value
              </label>
              <input
                id="panel-value"
                className="field-input"
                type="text"
                inputMode="decimal"
                value={formatCurrencyInput(valueForm.value)}
                onChange={(e) =>
                  setValueForm((prev) => ({
                    ...prev,
                    value: parseCurrencyInput(e.target.value),
                  }))
                }
                onFocus={(e) => e.target.select()}
                placeholder="$0.00"
              />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="panel-notes">
                Notes
              </label>
              <input
                id="panel-notes"
                className="field-input"
                type="text"
                value={valueForm.notes}
                onChange={(e) =>
                  setValueForm((prev) => ({ ...prev, notes: e.target.value }))
                }
                onFocus={(e) => e.target.select()}
                placeholder="Optional note"
              />
            </div>
            <div className="asset-note">
              Liabilities are entered as positive values and displayed as negative.
            </div>
            <div className="review-actions">
              <button
                className="primary-btn"
                type="submit"
                disabled={valueState === "saving" || !valueForm.value}
              >
                {valueState === "saving" ? "Saving..." : "Save value"}
              </button>
              {valueState === "saved" ? (
                <span className="chip">Saved</span>
              ) : null}
              {valueState === "error" ? (
                <span className="chip warn">Check values</span>
              ) : null}
              {valueError ? (
                <span className="asset-note">{valueError}</span>
              ) : null}
            </div>
          </div>
        </form>
      )}

      {/* Value history */}
      {historyEntries.length > 0 && (
        <div className="right-drawer-actions">
          <div className="right-drawer-detail">
            <span className="right-drawer-label" style={{ fontWeight: 600 }}>
              Value history
            </span>
            {historyEntries.length > 3 && (
              <button
                className="pill"
                type="button"
                onClick={() => setHistoryExpanded((prev) => !prev)}
              >
                {historyExpanded
                  ? "Show recent"
                  : `Show all (${historyEntries.length})`}
              </button>
            )}
          </div>
          {visibleEntries.map((entry) => (
            <div key={entry.id} className="right-drawer-detail">
              <span className="right-drawer-label">
                {entry.recordedLabel}
                {entry.source && entry.source !== "manual"
                  ? ` · ${entry.source}`
                  : ""}
              </span>
              <span className="right-drawer-value">
                {formatValueWithHomeMasked(
                  entry.formattedValue,
                  entry.formattedAudValue,
                  entry.currency,
                  homeCurrency,
                  isVisible
                )}
                <button
                  className="pill danger-btn"
                  type="button"
                  onClick={() => onDeleteValue(entry.id)}
                  disabled={deleteState === "saving"}
                  style={{ marginLeft: 8, fontSize: 10, padding: "2px 8px" }}
                >
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Dispose button (hidden when disposed) */}
      {!isDisposed && (
        <div className="right-drawer-actions">
          <button
            className="pill danger-btn"
            type="button"
            onClick={() => onDispose(asset)}
            disabled={saveState === "saving"}
          >
            Dispose asset
          </button>
        </div>
      )}

      {/* Delete section with confirmation */}
      <div className="right-drawer-delete">
        {!showConfirm ? (
          <button
            className="btn-delete"
            type="button"
            onClick={() => setShowConfirm(true)}
            disabled={deleteState === "saving"}
          >
            Remove asset
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
                  onDelete(asset);
                }}
                disabled={deleteState === "saving"}
              >
                {deleteState === "saving" ? "Deleting..." : "Yes, remove"}
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
