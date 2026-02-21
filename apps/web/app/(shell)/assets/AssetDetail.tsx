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

function AssetDetailView(props: AssetDetailViewProps) {
  // Placeholder — implemented in Task 2
  return <div>View mode placeholder</div>;
}
