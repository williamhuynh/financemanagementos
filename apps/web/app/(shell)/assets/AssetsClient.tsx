"use client";

import { useMemo, useState, useEffect } from "react";
import { Card, SectionHead, TrendRangeToggle, DetailPanel } from "@tandemly/ui";
import type { TrendRange } from "@tandemly/ui";
import type { AssetOverview, AssetItem, AssetHistoryEntry } from "../../../lib/data";
import { useNumberVisibility } from "../../../lib/number-visibility-context";
import { maskCurrencyValue, filterSeriesByRange } from "../../../lib/data";
import AssetDetail from "./AssetDetail";

type AssetsClientProps = {
  overview: AssetOverview;
  ownerOptions: string[];
  homeCurrency: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type AssetSeries = {
  id: string;
  label: string;
  points: string;
  color: string;
};

type PanelState =
  | { mode: "view"; assetId: string }
  | { mode: "add"; categoryType: string }
  | null;

function normalizeKey(value: string) {
  return value.trim().toLowerCase();
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

function buildOwnerLabel(owner: string) {
  return owner || "Joint";
}

export default function AssetsClient({ overview, ownerOptions, homeCurrency }: AssetsClientProps) {
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

  const [panelState, setPanelState] = useState<PanelState>(null);
  const [assetState, setAssetState] = useState<SaveState>("idle");
  const [assetError, setAssetError] = useState<string>("");
  const [valueState, setValueState] = useState<SaveState>("idle");
  const [valueError, setValueError] = useState<string>("");
  const [deleteState, setDeleteState] = useState<SaveState>("idle");
  const [refreshState, setRefreshState] = useState<SaveState>("idle");
  const [activeHistoryCategory, setActiveHistoryCategory] = useState<string | null>(
    null
  );
  const [historyExpanded, setHistoryExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOverviewState(overview);
  }, [overview]);

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

  const [trendRange, setTrendRange] = useState<TrendRange>("ALL");

  const filteredNetWorthSeries = useMemo(
    () => filterSeriesByRange(netWorthSeries, trendRange),
    [netWorthSeries, trendRange]
  );

  const filteredAssetSeries = useMemo(() => {
    const result: Record<string, typeof netWorthSeries> = {};
    for (const [key, series] of Object.entries(assetSeries)) {
      result[key] = filterSeriesByRange(series, trendRange);
    }
    return result;
  }, [assetSeries, trendRange]);

  const trendData = useMemo(() => {
    const allSeries = [filteredNetWorthSeries];
    Object.values(filteredAssetSeries).forEach((series) => {
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
      netWorthPoints: buildTrendPoints(filteredNetWorthSeries, min, max)
    };
  }, [filteredNetWorthSeries, filteredAssetSeries]);

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
      const assetTrend = filteredAssetSeries[asset.id] ?? [];
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
  }, [assets, filteredAssetSeries, trendData]);

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

  const selectedAsset = useMemo(() => {
    if (panelState?.mode !== "view") return null;
    const all = [...assets, ...disposedAssets];
    return all.find((a) => a.id === panelState.assetId) ?? null;
  }, [panelState, assets, disposedAssets]);

  const selectedAssetHistory = useMemo(() => {
    if (!selectedAsset) return [];
    const byId = historyByAsset.get(selectedAsset.id);
    if (byId && byId.length > 0) return byId;
    return historyByAsset.get(normalizeKey(selectedAsset.name)) ?? [];
  }, [selectedAsset, historyByAsset]);

  const heroSub =
    lastUpdatedLabel === "No updates yet"
      ? "No updates yet"
      : `Last update: ${lastUpdatedLabel}`;

  const handleHistoryToggle = (assetId: string) => {
    setHistoryExpanded((prev) => ({
      ...prev,
      [assetId]: !prev[assetId]
    }));
  };

  const handleAssetRowClick = (id: string) => {
    setPanelState((prev) =>
      prev?.mode === "view" && prev.assetId === id
        ? null
        : { mode: "view", assetId: id }
    );
  };

  const handleAddAssetClick = (categoryType: string) => {
    setPanelState({ mode: "add", categoryType });
  };

  const handlePanelSave = async (
    id: string,
    data: { name: string; type: string; owner: string; currency: string }
  ) => {
    setAssetState("saving");
    setAssetError("");
    try {
      const response = await fetch(`/api/assets/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Save failed");
      setAssetState("saved");
      await refreshOverview();
    } catch {
      setAssetState("error");
      setAssetError("Unable to save asset. Try again.");
    }
  };

  const handlePanelCreate = async (
    data: { name: string; type: string; owner: string; currency: string }
  ) => {
    setAssetState("saving");
    setAssetError("");
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Save failed");
      setAssetState("saved");
      setPanelState(null);
      const refreshed = await refreshOverview();
      if (!refreshed) {
        setAssetState("error");
        setAssetError("Asset saved, but refresh failed.");
      }
    } catch {
      setAssetState("error");
      setAssetError("Unable to save asset. Try again.");
    }
  };

  const handlePanelSaveValue = async (data: {
    assetId: string;
    assetName: string;
    assetType: string;
    value: number;
    currency: string;
    recordedAt: string;
    source: string;
    notes?: string;
  }) => {
    setValueState("saving");
    setValueError("");
    try {
      const response = await fetch("/api/assets/values", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordedAt: data.recordedAt,
          items: [{
            assetId: data.assetId,
            assetName: data.assetName,
            assetType: data.assetType,
            value: data.value,
            currency: data.currency,
            source: data.source,
            notes: data.notes,
          }],
        }),
      });
      if (!response.ok) throw new Error("Save failed");
      setValueState("saved");
      await refreshOverview();
    } catch {
      setValueState("error");
      setValueError("Unable to save asset value. Try again.");
    }
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
    setDeleteState("saving");
    try {
      const response = await fetch(`/api/assets/${asset.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      setDeleteState("saved");
      setPanelState(null);
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
        setAssetError("Unable to delete value entry. Try again.");
      }
    } catch (error) {
      setDeleteState("error");
      setAssetError("Unable to delete value entry. Try again.");
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
            <TrendRangeToggle value={trendRange} onChange={setTrendRange} />
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
            <div className="card-sub">Click an asset to view details</div>
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
                  onClick={() => handleAddAssetClick(category.type)}
                >
                  Add asset
                </button>
              </div>
              {items.length === 0 ? (
                <div className="empty-state">No assets yet.</div>
              ) : (
                <div className="asset-list-table">
                  <div className="asset-list-header">
                    <span>Asset</span>
                    <span>Owner</span>
                    <span>Latest value</span>
                    <span>Last updated</span>
                  </div>
                  {items.map((asset) => (
                    <div
                      key={asset.id}
                      className={`asset-row-block${
                        panelState?.mode === "view" && panelState.assetId === asset.id
                          ? " selected"
                          : ""
                      }`}
                      onClick={() => handleAssetRowClick(asset.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleAssetRowClick(asset.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="asset-list-row">
                        <span>{asset.name}</span>
                        <span>{buildOwnerLabel(asset.owner)}</span>
                        <span>
                          {formatValueWithHomeMasked(
                            asset.formattedValue,
                            asset.formattedAudValue,
                            asset.currency,
                            homeCurrency,
                            isVisible
                          )}
                        </span>
                        <span>{asset.lastUpdatedLabel}</span>
                      </div>
                    </div>
                  ))}
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
                                      {formatValueWithHomeMasked(
                                        entry.formattedValue,
                                        entry.formattedAudValue,
                                        entry.currency,
                                        homeCurrency,
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
            <div className="asset-history-header disposed-header">
              <span>Asset</span>
              <span>Type</span>
              <span>Owner</span>
              <span>Last value</span>
              <span>Last updated</span>
              <span>Status</span>
            </div>
            {disposedAssets.map((asset) => (
              <div
                key={asset.id}
                className={`asset-history-row disposed-row${
                  panelState?.mode === "view" && panelState.assetId === asset.id
                    ? " selected"
                    : ""
                }`}
                onClick={() => handleAssetRowClick(asset.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleAssetRowClick(asset.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <span>{asset.name}</span>
                <span>{asset.typeLabel}</span>
                <span>{buildOwnerLabel(asset.owner)}</span>
                <span>
                  {formatValueWithHomeMasked(
                    asset.formattedValue,
                    asset.formattedAudValue,
                    asset.currency,
                    homeCurrency,
                    isVisible
                  )}
                </span>
                <span>{asset.lastUpdatedLabel}</span>
                <span>Disposed</span>
              </div>
            ))}
          </div>
        </article>
      ) : null}

      <DetailPanel
        open={panelState !== null}
        onClose={() => setPanelState(null)}
        title={panelState?.mode === "add" ? "New Asset" : "Asset Details"}
      >
        {panelState?.mode === "view" && selectedAsset ? (
          <AssetDetail
            mode="view"
            asset={selectedAsset}
            categories={categories}
            ownerOptions={ownerOptions}
            homeCurrency={homeCurrency}
            historyEntries={selectedAssetHistory}
            isVisible={isVisible}
            onSave={handlePanelSave}
            onDispose={handleDisposeAsset}
            onDelete={handleHardDeleteAsset}
            onSaveValue={handlePanelSaveValue}
            onDeleteValue={handleHardDeleteValue}
            saveState={assetState}
            saveError={assetError}
            valueState={valueState}
            valueError={valueError}
            deleteState={deleteState}
          />
        ) : panelState?.mode === "add" ? (
          <AssetDetail
            mode="add"
            categories={categories}
            ownerOptions={ownerOptions}
            homeCurrency={homeCurrency}
            initialType={panelState.categoryType}
            onCreateAsset={handlePanelCreate}
            saveState={assetState}
            saveError={assetError}
          />
        ) : null}
      </DetailPanel>
    </>
  );
}
