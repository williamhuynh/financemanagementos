"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Card, SectionHead } from "@tandemly/ui";
import type { AssetOverview, AssetItem, AssetHistoryEntry } from "../../../lib/data";
import { useNumberVisibility } from "../../../lib/number-visibility-context";
import { maskCurrencyValue } from "../../../lib/data";

type AssetsClientProps = {
  overview: AssetOverview;
  ownerOptions: string[];
};

type AssetFormState = {
  id?: string;
  name: string;
  type: string;
  owner: string;
  currency: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type AssetSeries = {
  id: string;
  label: string;
  points: string;
  color: string;
};

type ActiveEditor =
  | { mode: "add"; categoryType: string }
  | { mode: "edit"; assetId: string }
  | { mode: "update"; assetId: string }
  | null;

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
}

function formatLocalDateTime(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

function getMonthEndDate(value: Date) {
  const year = value.getFullYear();
  const month = value.getMonth();
  return new Date(year, month + 1, 0, 23, 59);
}

function buildTrendPoints(series: AssetOverview["netWorthSeries"], min: number, max: number) {
  if (series.length === 0) {
    return "";
  }
  const width = 360;
  const top = 20;
  const bottom = 120;
  const height = bottom - top;
  const range = max - min || 1;
  const step = series.length > 1 ? width / (series.length - 1) : width;

  return series
    .map((point, index) => {
      const x = index * step;
      const normalized = (point.value - min) / range;
      const y = bottom - normalized * height;
      return `${x},${y}`;
    })
    .join(" ");
}

function getSeriesColor(assetType: string) {
  switch (assetType) {
    case "property":
      return "var(--accent)";
    case "liability":
    case "mortgage":
    case "other_liability":
      return "var(--liability)";
    case "shares":
      return "var(--asset)";
    case "managed_fund":
      return "#3e6be6";
    case "superannuation":
      return "#8a92a6";
    case "cash":
      return "#9fd0ff";
    default:
      return "var(--text-secondary)";
  }
}

function getDefaultValue(asset: AssetItem) {
  if (asset.latestValue === null) {
    return "";
  }
  return Math.abs(asset.latestValue).toString();
}

function formatValueWithAud(value: string, audValue: string, currency: string) {
  if (!currency || currency.toUpperCase() === "AUD") {
    return value;
  }
  return `${value} (${audValue})`;
}

function formatValueWithAudMasked(
  value: string,
  audValue: string,
  currency: string,
  isVisible: boolean
) {
  const maskedValue = maskCurrencyValue(value, isVisible);
  if (!currency || currency.toUpperCase() === "AUD") {
    return maskedValue;
  }
  const maskedAudValue = maskCurrencyValue(audValue, isVisible);
  return `${maskedValue} (${maskedAudValue})`;
}

function buildOwnerLabel(owner: string) {
  return owner || "Joint";
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

export default function AssetsClient({ overview, ownerOptions }: AssetsClientProps) {
  const { isVisible } = useNumberVisibility();
  const [overviewState, setOverviewState] = useState<AssetOverview>(overview);
  const {
    categories,
    assets,
    disposedAssets,
    history,
    netWorthSeries,
    assetSeries,
    netWorthFormatted,
    lastUpdatedLabel
  } = overviewState;

  const [activeEditor, setActiveEditor] = useState<ActiveEditor>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [recordedAt, setRecordedAt] = useState(() => formatLocalDateTime(new Date()));
  const [useMonthEnd, setUseMonthEnd] = useState(false);
  const [source, setSource] = useState("manual");
  const [valueMap, setValueMap] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    assets.forEach((asset) => {
      initial[asset.id] = getDefaultValue(asset);
    });
    return initial;
  });
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});
  const [valueState, setValueState] = useState<SaveState>("idle");
  const [valueError, setValueError] = useState<string>("");

  const [assetForm, setAssetForm] = useState<AssetFormState>(() => {
    const firstType = categories[0]?.type ?? "property";
    return {
      name: "",
      type: firstType,
      owner: "Joint",
      currency: "AUD"
    };
  });
  const [assetState, setAssetState] = useState<SaveState>("idle");
  const [assetError, setAssetError] = useState<string>("");
  const [deleteState, setDeleteState] = useState<SaveState>("idle");
  const [refreshState, setRefreshState] = useState<SaveState>("idle");
  const [activeHistoryCategory, setActiveHistoryCategory] = useState<string | null>(
    null
  );
  const [historyExpanded, setHistoryExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverviewState(overview);
  }, [overview]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (activeEditor?.mode !== "update") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveEditor(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeEditor]);

  useEffect(() => {
    setValueMap(() => {
      const next: Record<string, string> = {};
      assets.forEach((asset) => {
        next[asset.id] = getDefaultValue(asset);
      });
      return next;
    });
    setNoteMap({});
    setValueState("idle");
    setValueError("");
    if (activeEditor?.mode === "update") {
      const exists = assets.some((asset) => asset.id === activeEditor.assetId);
      if (!exists) {
        setActiveEditor(null);
      }
    }
  }, [assets, activeEditor]);

  const refreshOverview = async () => {
    setRefreshState("saving");
    try {
      const response = await fetch("/api/assets/overview", {
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Refresh failed");
      }
      const data = (await response.json()) as AssetOverview;
      setOverviewState(data);
      setRefreshState("saved");
      return true;
    } catch (error) {
      setRefreshState("error");
      return false;
    }
  };


  const trendData = useMemo(() => {
    const allSeries = [netWorthSeries];
    Object.values(assetSeries).forEach((series) => {
      if (series.length > 0) {
        allSeries.push(series);
      }
    });
    const values = allSeries.flatMap((series) => series.map((point) => point.value));
    const min = values.length > 0 ? Math.min(...values) : 0;
    const max = values.length > 0 ? Math.max(...values) : 1;
    return {
      min,
      max,
      netWorthPoints: buildTrendPoints(netWorthSeries, min, max)
    };
  }, [netWorthSeries, assetSeries]);

  const chartSeries = useMemo<AssetSeries[]>(() => {
    const series: AssetSeries[] = [
      {
        id: "net-worth",
        label: "Net worth",
        points: trendData.netWorthPoints,
        color: "var(--accent-soft)"
      }
    ];
    assets.forEach((asset) => {
      const assetTrend = assetSeries[asset.id] ?? [];
      if (assetTrend.length === 0) {
        return;
      }
      series.push({
        id: asset.id,
        label: asset.name,
        points: buildTrendPoints(assetTrend, trendData.min, trendData.max),
        color: getSeriesColor(asset.type)
      });
    });
    return series;
  }, [assets, assetSeries, trendData]);

  const hasTrend = useMemo(
    () => chartSeries.some((series) => series.points.split(" ").length > 1),
    [chartSeries]
  );

  const historyByAsset = useMemo(() => {
    const map = new Map<string, AssetHistoryEntry[]>();
    history.forEach((entry) => {
      const key = entry.assetId ? entry.assetId : normalizeKey(entry.name);
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    });
    return map;
  }, [history]);

  const assetsByType = useMemo(() => {
    const map = new Map<string, AssetItem[]>();
    assets.forEach((asset) => {
      const bucket = map.get(asset.type) ?? [];
      bucket.push(asset);
      map.set(asset.type, bucket);
    });
    return map;
  }, [assets]);

  const editableAssets = useMemo(() => {
    if (activeEditor?.mode !== "update") {
      return [];
    }
    return assets.filter((asset) => asset.id === activeEditor.assetId);
  }, [assets, activeEditor]);

  const heroSub =
    lastUpdatedLabel === "No updates yet"
      ? "No updates yet"
      : `Last update: ${lastUpdatedLabel}`;

  const handleRecordedAtChange = (nextValue: string) => {
    if (useMonthEnd) {
      const parsed = new Date(nextValue);
      if (!Number.isNaN(parsed.valueOf())) {
        setRecordedAt(formatLocalDateTime(getMonthEndDate(parsed)));
        return;
      }
    }
    setRecordedAt(nextValue);
  };

  const handleMonthEndToggle = (checked: boolean) => {
    setUseMonthEnd(checked);
    if (checked) {
      const base = recordedAt ? new Date(recordedAt) : new Date();
      if (!Number.isNaN(base.valueOf())) {
        setRecordedAt(formatLocalDateTime(getMonthEndDate(base)));
      }
    }
  };

  const resetAssetForm = (type?: string) => {
    const nextType = type ?? categories[0]?.type ?? "property";
    setAssetForm({ name: "", type: nextType, owner: "Joint", currency: "AUD" });
    setAssetState("idle");
    setAssetError("");
  };

  const handleOpenAssetForm = (type?: string) => {
    resetAssetForm(type);
    setActiveEditor({ mode: "add", categoryType: type ?? categories[0]?.type ?? "property" });
  };

  const handleEditAsset = (asset: AssetItem) => {
    setAssetForm({
      id: asset.id,
      name: asset.name,
      type: asset.type,
      owner: asset.owner,
      currency: asset.currency
    });
    setAssetState("idle");
    setAssetError("");
    setActiveEditor({ mode: "edit", assetId: asset.id });
  };

  const handleDisposeAsset = async (asset: AssetItem) => {
    setAssetState("saving");
    setAssetError("");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "disposed",
          disposedAt: new Date().toISOString()
        })
      });
      if (!response.ok) {
        throw new Error("Dispose failed");
      }
      setAssetState("saved");
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setAssetState("error");
        setAssetError("Asset updated, but refresh failed.");
      }
    } catch (error) {
      setAssetState("error");
      setAssetError("Unable to dispose asset. Try again.");
    }
  };

  const handleHardDeleteAsset = async (asset: AssetItem) => {
    const confirmed = window.confirm(
      "Remove this asset from the UI? It will be archived."
    );
    if (!confirmed) {
      return;
    }
    setDeleteState("saving");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      setDeleteState("saved");
      setActiveEditor(null);
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setDeleteState("error");
        setAssetError("Asset deleted, but refresh failed.");
      }
    } catch (error) {
      setDeleteState("error");
      setAssetError("Unable to delete asset. Try again.");
    }
  };

  const handleHardDeleteValue = async (entryId: string) => {
    const confirmed = window.confirm(
      "Remove this value update from the UI? It will be archived."
    );
    if (!confirmed) {
      return;
    }
    setDeleteState("saving");
    try {
      const response = await fetch(`/api/assets/values/${entryId}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      setDeleteState("saved");
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setDeleteState("error");
        setAssetError("Entry deleted, but refresh failed.");
      }
    } catch (error) {
      setDeleteState("error");
      setAssetError("Unable to delete value entry. Try again.");
    }
  };

  const handleHistoryToggle = (assetId: string) => {
    setHistoryExpanded((prev) => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  const handleSubmitAsset = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAssetError("");
    if (!assetForm.name.trim()) {
      setAssetState("error");
      setAssetError("Asset name is required.");
      return;
    }
    setAssetState("saving");
    const payload = {
      name: assetForm.name.trim(),
      type: assetForm.type,
      owner: assetForm.owner,
      currency: assetForm.currency.trim() || "AUD"
    };
    try {
      const response = await fetch(
        assetForm.id ? `/api/assets/${assetForm.id}` : "/api/assets",
        {
          method: assetForm.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setAssetState("saved");
      setActiveEditor(null);
      resetAssetForm(assetForm.type);
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setAssetState("error");
        setAssetError("Asset saved, but refresh failed.");
      }
    } catch (error) {
      setAssetState("error");
      setAssetError("Unable to save asset. Try again.");
    }
  };

  const handleSubmitValues = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValueError("");
    setValueState("saving");
    const items = editableAssets
      .map((asset) => {
        const valueRaw = valueMap[asset.id];
        if (!valueRaw) {
          return null;
        }
        const value = Number(valueRaw);
        if (!Number.isFinite(value)) {
          return null;
        }
        return {
          assetId: asset.id,
          assetName: asset.name,
          assetType: asset.type,
          value,
          currency: asset.currency,
          source: source.trim() || "manual",
          notes: noteMap[asset.id] || undefined
        };
      })
      .filter(Boolean) as {
      assetId: string;
      assetName: string;
      assetType: string;
      value: number;
      currency: string;
      source: string;
      notes?: string;
    }[];

    if (items.length === 0) {
      setValueState("error");
      setValueError("Add at least one value to save.");
      return;
    }

    try {
      const response = await fetch("/api/assets/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordedAt: recordedAt
            ? new Date(recordedAt).toISOString()
            : new Date().toISOString(),
          items
        })
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setValueState("saved");
      setActiveEditor(null);
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setValueState("error");
        setValueError("Values saved, but refresh failed.");
      }
    } catch (err) {
      setValueState("error");
      setValueError("Unable to save asset values. Try again.");
    }
  };

  return (
    <>
      <SectionHead
        title="Portfolio Snapshot"
      />

      <div className="hero">
        <div>
          <div className="eyebrow">Net Worth</div>
          <div className="hero-value">{maskCurrencyValue(netWorthFormatted, isVisible)}</div>
          <div className="hero-sub">{heroSub}</div>
        </div>
      <div className="hero-meta">
        <div className="meta-pill">{history.length} recent updates</div>
        {refreshState === "saving" ? (
          <div className="meta-pill">Syncing updates...</div>
        ) : null}
      </div>
      </div>

      <div className="grid cards">
        {categories.map((category) => (
          <Card
            key={category.type}
            title={category.label}
            value={maskCurrencyValue(category.formattedValue, isVisible)}
            sub={category.subLabel}
            tone={category.tone}
          />
        ))}
      </div>

      <div className="grid charts">
        <article className="card chart wide">
          <div className="chart-head">
            <div>
              <div className="card-title">Net Worth Trend</div>
              <div className="card-sub">Monthly snapshots</div>
            </div>
          </div>
          <div className="chart-body">
            {hasTrend ? (
              <div className="asset-trend">
                <svg viewBox="0 0 360 140" aria-hidden="true">
                  {chartSeries.map((series) => (
                    <polyline
                      key={series.id}
                      className="trend-line"
                      points={series.points}
                      style={{ stroke: series.color }}
                    />
                  ))}
                </svg>
                <div className="chart-legend asset-trend-legend">
                  {chartSeries.map((series) => (
                    <div key={`${series.id}-legend`}>
                      <span
                        className="legend-swatch"
                        style={{ background: series.color }}
                      />
                      {series.label}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                Add at least two monthly snapshots to see the trend.
              </div>
            )}
          </div>
        </article>
      </div>

      <article className="card asset-list">
        <div className="chart-head">
          <div>
            <div className="card-title">Assets by category</div>
            <div className="card-sub">Add, edit, and dispose assets</div>
          </div>
        </div>
        {categories.map((category) => {
          const items = assetsByType.get(category.type) ?? [];
          return (
            <div key={category.type} className="asset-group">
              <div className="asset-group-head">
                <div className="asset-history-title">{category.label}</div>
                <button
                  className="pill"
                  type="button"
                  onClick={() => handleOpenAssetForm(category.type)}
                >
                  Add asset
                </button>
              </div>
              {activeEditor?.mode === "add" &&
              activeEditor.categoryType === category.type ? (
                <div className="asset-inline-form">
                  <div className="asset-inline-head">
                    <div className="card-title">Add asset</div>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => setActiveEditor(null)}
                    >
                      Cancel
                    </button>
                  </div>
                  <form onSubmit={handleSubmitAsset}>
                    <div className="asset-form-grid">
                      <div className="field">
                        <label className="field-label" htmlFor="asset-name">
                          Asset name
                        </label>
                        <input
                          id="asset-name"
                          className="field-input"
                          type="text"
                          value={assetForm.name}
                          onChange={(event) =>
                            setAssetForm((prev) => ({
                              ...prev,
                              name: event.target.value
                            }))
                          }
                          placeholder="CMC Portfolio"
                        />
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="asset-type">
                          Category
                        </label>
                        <select
                          id="asset-type"
                          className="field-input"
                          value={assetForm.type}
                          onChange={(event) =>
                            setAssetForm((prev) => ({
                              ...prev,
                              type: event.target.value
                            }))
                          }
                        >
                          {categories.map((option) => (
                            <option key={option.type} value={option.type}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="field">
                        <label className="field-label" htmlFor="asset-owner">
                          Owner
                        </label>
                        <select
                          id="asset-owner"
                          className="field-input"
                          value={assetForm.owner}
                          onChange={(event) =>
                            setAssetForm((prev) => ({
                              ...prev,
                              owner: event.target.value
                            }))
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
                        <label className="field-label" htmlFor="asset-currency">
                          Currency
                        </label>
                        <select
                          id="asset-currency"
                          className="field-input"
                          value={assetForm.currency}
                          onChange={(event) =>
                            setAssetForm((prev) => ({
                              ...prev,
                              currency: event.target.value
                            }))
                          }
                        >
                          <option value="AUD">AUD</option>
                          <option value="USD">USD</option>
                        </select>
                      </div>
                    </div>
                    <div className="review-actions">
                      <button
                        className="primary-btn"
                        type="submit"
                        disabled={assetState === "saving"}
                      >
                        {assetState === "saving" ? "Saving..." : "Save asset"}
                      </button>
                      {assetState === "saved" ? <span className="chip">Saved</span> : null}
                      {assetState === "error" ? (
                        <span className="chip warn">Check details</span>
                      ) : null}
                      {assetError ? (
                        <span className="asset-note">{assetError}</span>
                      ) : null}
                    </div>
                  </form>
                </div>
              ) : null}
              {items.length === 0 ? (
                <div className="empty-state">No assets yet.</div>
              ) : (
                <div className="asset-list-table">
                  <div className="asset-list-header">
                    <span>Asset</span>
                    <span>Owner</span>
                    <span>Latest value</span>
                    <span>Last updated</span>
                    <span>Actions</span>
                  </div>
                  {items.map((asset) => {
                    const showEdit =
                      activeEditor?.mode === "edit" &&
                      activeEditor.assetId === asset.id;
                    const showUpdate =
                      activeEditor?.mode === "update" &&
                      activeEditor.assetId === asset.id;
                    return (
                      <div key={asset.id} className="asset-row-block">
                        <div className="asset-list-row">
                          <span>{asset.name}</span>
                      <span>{buildOwnerLabel(asset.owner)}</span>
                      <span>
                        {formatValueWithAudMasked(
                          asset.formattedValue,
                          asset.formattedAudValue,
                          asset.currency,
                          isVisible
                        )}
                      </span>
                          <span>{asset.lastUpdatedLabel}</span>
                          <span className="asset-row-actions">
                            <button
                              className="pill"
                              type="button"
                              onClick={() =>
                                {
                                  setValueState("idle");
                                  setValueError("");
                                  setActiveEditor({
                                    mode: "update",
                                    assetId: asset.id
                                  });
                                }
                              }
                            >
                              Update value
                            </button>
                            <button
                              className="pill"
                              type="button"
                              onClick={() => handleEditAsset(asset)}
                            >
                              Edit
                            </button>
                          </span>
                        </div>
                        {showEdit ? (
                          <div className="asset-inline-form">
                            <div className="asset-inline-head">
                              <div className="card-title">Edit asset</div>
                              <button
                                className="ghost-btn"
                                type="button"
                                onClick={() => setActiveEditor(null)}
                              >
                                Cancel
                              </button>
                            </div>
                            <form onSubmit={handleSubmitAsset}>
                              <div className="asset-form-grid">
                                <div className="field">
                                  <label
                                    className="field-label"
                                    htmlFor={`asset-name-edit-${asset.id}`}
                                  >
                                    Asset name
                                  </label>
                                  <input
                                    id={`asset-name-edit-${asset.id}`}
                                    className="field-input"
                                    type="text"
                                    value={assetForm.name}
                                    onChange={(event) =>
                                      setAssetForm((prev) => ({
                                        ...prev,
                                        name: event.target.value
                                      }))
                                    }
                                    placeholder="CMC Portfolio"
                                  />
                                </div>
                                <div className="field">
                                  <label
                                    className="field-label"
                                    htmlFor={`asset-type-edit-${asset.id}`}
                                  >
                                    Category
                                  </label>
                                  <select
                                    id={`asset-type-edit-${asset.id}`}
                                    className="field-input"
                                    value={assetForm.type}
                                    onChange={(event) =>
                                      setAssetForm((prev) => ({
                                        ...prev,
                                        type: event.target.value
                                      }))
                                    }
                                  >
                                    {categories.map((option) => (
                                      <option key={option.type} value={option.type}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="field">
                                  <label
                                    className="field-label"
                                    htmlFor={`asset-owner-edit-${asset.id}`}
                                  >
                                    Owner
                                  </label>
                                  <select
                                    id={`asset-owner-edit-${asset.id}`}
                                    className="field-input"
                                    value={assetForm.owner}
                                    onChange={(event) =>
                                      setAssetForm((prev) => ({
                                        ...prev,
                                        owner: event.target.value
                                      }))
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
                                  <label
                                    className="field-label"
                                    htmlFor={`asset-currency-edit-${asset.id}`}
                                  >
                                    Currency
                                  </label>
                                  <select
                                    id={`asset-currency-edit-${asset.id}`}
                                    className="field-input"
                                    value={assetForm.currency}
                                    onChange={(event) =>
                                      setAssetForm((prev) => ({
                                        ...prev,
                                        currency: event.target.value
                                      }))
                                    }
                                  >
                                    <option value="AUD">AUD</option>
                                    <option value="USD">USD</option>
                                  </select>
                                </div>
                              </div>
                              <div className="review-actions">
                                <button
                                  className="primary-btn"
                                  type="submit"
                                  disabled={assetState === "saving"}
                                >
                                  {assetState === "saving"
                                    ? "Saving..."
                                    : "Save changes"}
                                </button>
                                <button
                                  className="pill danger-btn"
                                  type="button"
                                  onClick={() => handleDisposeAsset(asset)}
                                  disabled={assetState === "saving"}
                                >
                                  Dispose asset
                                </button>
                                <button
                                  className="pill danger-btn"
                                  type="button"
                                  onClick={() => handleHardDeleteAsset(asset)}
                                  disabled={deleteState === "saving"}
                                >
                                  Remove asset
                                </button>
                                {assetState === "saved" ? (
                                  <span className="chip">Saved</span>
                                ) : null}
                                {assetState === "error" ? (
                                  <span className="chip warn">Check details</span>
                                ) : null}
                                {assetError ? (
                                  <span className="asset-note">{assetError}</span>
                                ) : null}
                              </div>
                            </form>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </article>

      <article className="card asset-history">
        <div className="chart-head">
          <div>
            <div className="card-title">Update history</div>
            <div className="card-sub">Grouped by category</div>
          </div>
        </div>
        <div className="asset-history-accordion">
          {categories.map((category) => {
            const items = assetsByType.get(category.type) ?? [];
            const updateCount = items.reduce((count, asset) => {
              const entries =
                historyByAsset.get(asset.id) ??
                historyByAsset.get(normalizeKey(asset.name)) ??
                [];
              return count + entries.length;
            }, 0);
            const isOpen = activeHistoryCategory === category.type;
            return (
              <section key={category.type} className="asset-history-category">
                <button
                  className="asset-history-category-toggle"
                  type="button"
                  onClick={() =>
                    setActiveHistoryCategory(isOpen ? null : category.type)
                  }
                  aria-expanded={isOpen}
                >
                  <div>
                    <div className="asset-history-category-title">{category.label}</div>
                    <div className="asset-note">
                      {items.length} assets • {updateCount} updates
                    </div>
                  </div>
                  <span className="asset-history-category-icon">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>
                {isOpen ? (
                  <div className="asset-history-category-body">
                    {items.length === 0 ? (
                      <div className="empty-state">No assets yet.</div>
                    ) : (
                      items.map((asset) => {
                        const entries =
                          historyByAsset.get(asset.id) ??
                          historyByAsset.get(normalizeKey(asset.name)) ??
                          [];
                        const showAll = historyExpanded[asset.id];
                        const visibleEntries = showAll
                          ? entries
                          : entries.slice(0, 3);
                        return (
                          <div key={asset.id} className="asset-history-group">
                            <div className="asset-history-asset-head">
                              <div>
                                <div className="asset-history-title">{asset.name}</div>
                                <div className="asset-note">
                                  {asset.typeLabel} • {buildOwnerLabel(asset.owner)}
                                </div>
                              </div>
                              {entries.length > 3 ? (
                                <button
                                  className="pill"
                                  type="button"
                                  onClick={() => handleHistoryToggle(asset.id)}
                                >
                                  {showAll
                                    ? "Show recent"
                                    : `Show all (${entries.length})`}
                                </button>
                              ) : null}
                            </div>
                            {entries.length === 0 ? (
                              <div className="empty-state">No updates yet.</div>
                            ) : (
                              <div className="asset-history-table">
                                <div className="asset-history-header">
                                  <span>Asset</span>
                                  <span>Type</span>
                                  <span>Value</span>
                                  <span>Recorded</span>
                                  <span>Source</span>
                                  <span>Notes</span>
                                  <span>Actions</span>
                                </div>
                                {visibleEntries.map((entry) => (
                                  <div key={entry.id} className="asset-history-row">
                                    <span>{entry.name}</span>
                                    <span>{entry.typeLabel}</span>
                                    <span>
                                      {formatValueWithAudMasked(
                                        entry.formattedValue,
                                        entry.formattedAudValue,
                                        entry.currency,
                                        isVisible
                                      )}
                                    </span>
                                    <span>{entry.recordedLabel}</span>
                                    <span>{entry.source || "manual"}</span>
                                    <span>{entry.notes || "-"}</span>
                                    <span className="asset-row-actions">
                                      <button
                                        className="pill danger-btn"
                                        type="button"
                                        onClick={() => handleHardDeleteValue(entry.id)}
                                        disabled={deleteState === "saving"}
                                      >
                                        Remove entry
                                      </button>
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </article>

      {disposedAssets.length > 0 ? (
        <article className="card asset-history">
          <div className="chart-head">
            <div>
              <div className="card-title">Disposed assets</div>
              <div className="card-sub">Assets marked as disposed</div>
            </div>
          </div>
          <div className="asset-history-table">
            <div className="asset-history-header">
              <span>Asset</span>
              <span>Type</span>
              <span>Owner</span>
              <span>Last value</span>
              <span>Last updated</span>
              <span>Status</span>
              <span>Actions</span>
            </div>
            {disposedAssets.map((asset) => (
              <div key={asset.id} className="asset-history-row">
                <span>{asset.name}</span>
                <span>{asset.typeLabel}</span>
                <span>{buildOwnerLabel(asset.owner)}</span>
                <span>
                  {formatValueWithAudMasked(
                    asset.formattedValue,
                    asset.formattedAudValue,
                    asset.currency,
                    isVisible
                  )}
                </span>
                <span>{asset.lastUpdatedLabel}</span>
                <span>Disposed</span>
                <span className="asset-row-actions">
                  <button
                    className="pill danger-btn"
                    type="button"
                    onClick={() => handleHardDeleteAsset(asset)}
                    disabled={deleteState === "saving"}
                  >
                    Remove asset
                  </button>
                </span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      {activeEditor?.mode === "update" && isMounted
        ? createPortal(
            <div className="spend-filter-modal" role="dialog" aria-modal="true">
              <button
                className="spend-filter-backdrop"
                type="button"
                aria-label="Close update value form"
                onClick={() => setActiveEditor(null)}
              />
              <div className="spend-filter-panel">
                <div className="spend-filter-head">
                  <div>
                    <div className="card-title">Update value</div>
                    <div className="card-sub">
                      Update asset value and add notes
                    </div>
                  </div>
                  <button
                    className="ghost-btn"
                    type="button"
                    onClick={() => setActiveEditor(null)}
                  >
                    Close
                  </button>
                </div>
                <form onSubmit={handleSubmitValues}>
                  <div className="field">
                    <label className="field-label" htmlFor="modal-recorded-at">
                      Recorded at
                    </label>
                    <input
                      id="modal-recorded-at"
                      className="field-input"
                      type="datetime-local"
                      value={recordedAt}
                      onChange={(event) =>
                        handleRecordedAtChange(event.target.value)
                      }
                      onFocus={(event) => event.target.select()}
                    />
                  </div>
                  <div className="field asset-toggle">
                    <label className="field-label" htmlFor="modal-month-end">
                      Use month-end
                    </label>
                    <label className="toggle">
                      <input
                        id="modal-month-end"
                        type="checkbox"
                        checked={useMonthEnd}
                        onChange={(event) =>
                          handleMonthEndToggle(event.target.checked)
                        }
                      />
                      <span>Snap to the last day of the month</span>
                    </label>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="modal-source">
                      Source
                    </label>
                    <input
                      id="modal-source"
                      className="field-input"
                      type="text"
                      value={source}
                      onChange={(event) => setSource(event.target.value)}
                      onFocus={(event) => event.target.select()}
                      placeholder="manual"
                    />
                  </div>
                  <div className="asset-update-table">
                    <div className="asset-update-header">
                      <span>Asset</span>
                      <span>Owner</span>
                      <span>Value</span>
                      <span>Notes</span>
                    </div>
                    {editableAssets.map((editable) => (
                      <div key={editable.id} className="asset-update-row">
                        <span>{editable.name}</span>
                        <span>{buildOwnerLabel(editable.owner)}</span>
                        <input
                          className="field-input"
                          type="text"
                          inputMode="decimal"
                          value={formatCurrencyInput(valueMap[editable.id] ?? "")}
                          onChange={(event) =>
                            setValueMap((prev) => ({
                              ...prev,
                              [editable.id]: parseCurrencyInput(event.target.value)
                            }))
                          }
                          onFocus={(event) => event.target.select()}
                          placeholder="$0.00"
                        />
                        <input
                          className="field-input"
                          type="text"
                          value={noteMap[editable.id] ?? ""}
                          onChange={(event) =>
                            setNoteMap((prev) => ({
                              ...prev,
                              [editable.id]: event.target.value
                            }))
                          }
                          onFocus={(event) => event.target.select()}
                          placeholder="Optional note"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="asset-note">
                    Liabilities are entered as positive values and displayed as
                    negative.
                  </div>
                  <div className="review-actions">
                    <button
                      className="primary-btn"
                      type="submit"
                      disabled={valueState === "saving"}
                    >
                      {valueState === "saving" ? "Saving..." : "Save snapshot"}
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
                </form>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
