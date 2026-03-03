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

export default function AdminClient() {
  const [workspaces, setWorkspaces] = useState<AdminWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AdminWorkspace | null>(null);
  const [editPlan, setEditPlan] = useState("free");
  const [editActiveFeatures, setEditActiveFeatures] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

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

  const openDetail = (ws: AdminWorkspace) => {
    setSelected(ws);
    setEditPlan(ws.plan);
    // Get active features (plan features + overrides)
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

  // Filter locally too (in case search param doesn't work without a full-text index)
  const filtered = search
    ? workspaces.filter((ws) => ws.name.toLowerCase().includes(search.toLowerCase()))
    : workspaces;

  return (
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
  );
}
