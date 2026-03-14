"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, DetailPanel } from "@tandemly/ui";
import { ALL_FEATURES, getWorkspaceFeatures, calculateOverrides } from "../../../lib/plans";
import { apiFetch } from "../../../lib/api-fetch";

interface AdminWorkspace {
  id: string;
  name: string;
  owner_id: string;
  plan: string;
  feature_overrides: string;
  memberCount: number;
  assetCount: number;
}

type SuggestionStatus = "new" | "approved" | "in_progress" | "done";

interface AdminSuggestion {
  id: string;
  workspace_id: string;
  workspace_name: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  status: SuggestionStatus;
  upvote_count: number;
  created_at: string;
}

const SUGGESTION_STATUSES: { value: SuggestionStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

type Tab = "workspaces" | "suggestions";

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState<Tab>("workspaces");

  // Workspaces tab state
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminWorkspace | null>(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editActiveFeatures, setEditActiveFeatures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Suggestions tab state
  const [suggestions, setSuggestions] = useState<AdminSuggestion[]>([]);
  const [sgLoading, setSgLoading] = useState(false);
  const [sgLoaded, setSgLoaded] = useState(false);
  const [sgStatusFilter, setSgStatusFilter] = useState<SuggestionStatus | "">("");
  const [sgUpdatingId, setSgUpdatingId] = useState<string | null>(null);
  const [sgError, setSgError] = useState<string | null>(null);
  const [sgSuccess, setSgSuccess] = useState<string | null>(null);
  const [sgTotal, setSgTotal] = useState<number>(0);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await apiFetch(`/api/admin/workspaces${params}`, { credentials: "include" });
      const data = await res.json();
      setWorkspaces(data.workspaces || []);
    } catch {
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const fetchSuggestions = useCallback(async () => {
    setSgLoading(true);
    setSgError(null);
    try {
      const params = sgStatusFilter ? `?status=${sgStatusFilter}` : "";
      const res = await apiFetch(`/api/admin/suggestions${params}`, { credentials: "include" });
      const data = await res.json();
      setSuggestions(data.suggestions || []);
      setSgTotal(data.total ?? data.suggestions?.length ?? 0);
      setSgLoaded(true);
    } catch {
      setSgError("Failed to load suggestions");
    } finally {
      setSgLoading(false);
    }
  }, [sgStatusFilter]);

  useEffect(() => {
    if (activeTab === "suggestions") {
      fetchSuggestions();
    }
  }, [activeTab, fetchSuggestions]);

  const openDetail = (ws: AdminWorkspace) => {
    setSelected(ws);
    setEditPlan(ws.plan);
    const activeFeatures = getWorkspaceFeatures(ws.plan, ws.feature_overrides);
    setEditActiveFeatures(activeFeatures);
  };

  const toggleFeature = (feature: string) => {
    setEditActiveFeatures((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      // Calculate the override array from active features
      const overrides = calculateOverrides(editPlan, editActiveFeatures);
      const overridesJson = JSON.stringify(overrides);

      await apiFetch(`/api/admin/workspaces/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan: editPlan,
          feature_overrides: overridesJson,
        }),
      });
      // Update local state
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === selected.id
            ? { ...ws, plan: editPlan, feature_overrides: overridesJson }
            : ws
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, plan: editPlan, feature_overrides: overridesJson } : null
      );
    } catch {
      // silently fail for now
    } finally {
      setSaving(false);
    }
  };

  const handleSuggestionStatus = async (id: string, status: SuggestionStatus) => {
    setSgUpdatingId(id);
    setSgError(null);
    setSgSuccess(null);
    try {
      const res = await apiFetch(`/api/admin/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSgError(data.error || "Failed to update");
        return;
      }
      // If a filter is active, remove rows that no longer match; otherwise update in place
      if (sgStatusFilter && status !== sgStatusFilter) {
        setSuggestions((prev) => prev.filter((s) => s.id !== id));
      } else {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, status } : s))
        );
      }
      setSgSuccess("Status updated.");
    } catch {
      setSgError("Failed to update suggestion");
    } finally {
      setSgUpdatingId(null);
    }
  };

  // Filter locally too (in case search param doesn't work without a full-text index)
  const filtered = search
    ? workspaces.filter((ws) => ws.name.toLowerCase().includes(search.toLowerCase()))
    : workspaces;

  return (
    <>
      <div className="admin-tabs" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button
          className={activeTab === "workspaces" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("workspaces")}
        >
          Workspaces
        </button>
        <button
          className={activeTab === "suggestions" ? "primary-btn" : "secondary-btn"}
          onClick={() => setActiveTab("suggestions")}
        >
          Suggestions
        </button>
      </div>

      {activeTab === "workspaces" && (
        <>
          <div className="admin-search">
            <input
              type="text"
              placeholder="Search workspaces..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Card title={`Workspaces (${filtered.length})`}>
            {loading && <p style={{ padding: 16 }}>Loading...</p>}
            {!loading && filtered.length === 0 && <p style={{ padding: 16 }}>No workspaces found.</p>}
            {filtered.map((ws) => (
              <div
                key={ws.id}
                className="admin-workspace-row"
                onClick={() => openDetail(ws)}
              >
                <div className="admin-workspace-info">
                  <span className="admin-workspace-name">{ws.name}</span>
                  <span className="admin-workspace-meta">
                    {ws.memberCount} member{ws.memberCount !== 1 ? "s" : ""} · {ws.assetCount} asset{ws.assetCount !== 1 ? "s" : ""}
                  </span>
                </div>
                <span className={`admin-plan-badge ${ws.plan}`}>{ws.plan}</span>
              </div>
            ))}
          </Card>

          <DetailPanel
            open={!!selected}
            onClose={() => setSelected(null)}
            title={selected?.name || "Workspace"}
          >
            {selected && (
              <div style={{ padding: "0 16px 16px" }}>
                <div className="admin-detail-field">
                  <label>Plan</label>
                  <select value={editPlan} onChange={(e) => {
                    const newPlan = e.target.value;
                    setEditPlan(newPlan);
                    // Recalculate active features when plan changes
                    // Keep the current active features, which will be converted to appropriate overrides
                  }}>
                    <option value="free">Free</option>
                    <option value="pro">Pro</option>
                  </select>
                </div>

                <div className="admin-detail-field">
                  <label>Active Features</label>
                  <div className="admin-feature-list">
                    {ALL_FEATURES.map((feature) => (
                      <label key={feature} className="admin-feature-item">
                        <input
                          type="checkbox"
                          checked={editActiveFeatures.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                        />
                        {feature.replace(/_/g, " ")}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="admin-detail-field">
                  <label>Stats</label>
                  <div className="admin-workspace-meta">
                    {selected.memberCount} member{selected.memberCount !== 1 ? "s" : ""} · {selected.assetCount} asset{selected.assetCount !== 1 ? "s" : ""}
                  </div>
                </div>

                <div style={{ marginTop: 16 }}>
                  <button
                    className="primary-btn"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </div>
            )}
          </DetailPanel>
        </>
      )}

      {activeTab === "suggestions" && (
        <div className="admin-suggestions">
          {sgError && <div className="form-error" style={{ marginBottom: 12 }}>{sgError}</div>}
          {sgSuccess && <div className="form-success" style={{ marginBottom: 12 }}>{sgSuccess}</div>}

          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <label style={{ fontWeight: 500 }}>Filter:</label>
            <select
              value={sgStatusFilter}
              onChange={(e) => setSgStatusFilter(e.target.value as SuggestionStatus | "")}
            >
              <option value="">All</option>
              {SUGGESTION_STATUSES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <Card title={
            sgLoaded && sgTotal > suggestions.length
              ? `Suggestions (showing ${suggestions.length} of ${sgTotal})`
              : `Suggestions (${suggestions.length})`
          }>
            {sgLoading && <p style={{ padding: 16 }}>Loading...</p>}
            {!sgLoading && sgLoaded && suggestions.length === 0 && (
              <p style={{ padding: 16 }}>No suggestions found.</p>
            )}
            {suggestions.map((s) => (
              <div key={s.id} className="admin-suggestion-row">
                <div className="admin-suggestion-info">
                  <span className="admin-suggestion-title">{s.title}</span>
                  <span className="admin-suggestion-meta">
                    {s.workspace_name} · {s.user_name} · ▲ {s.upvote_count}
                  </span>
                  <span className="admin-suggestion-desc">{s.description}</span>
                </div>
                <div className="admin-suggestion-actions">
                  <select
                    value={s.status}
                    disabled={sgUpdatingId === s.id}
                    onChange={(e) =>
                      handleSuggestionStatus(s.id, e.target.value as SuggestionStatus)
                    }
                  >
                    {SUGGESTION_STATUSES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </>
  );
}
