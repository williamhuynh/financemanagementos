"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, DetailPanel } from "@tandemly/ui";
import { ALL_FEATURES } from "../../../lib/plans";

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
  const [editOverrides, setEditOverrides] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const params = search ? `?search=${encodeURIComponent(search)}` : "";
      const res = await fetch(`/api/admin/workspaces${params}`, { credentials: "include" });
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
    try {
      setEditOverrides(JSON.parse(ws.feature_overrides));
    } catch {
      setEditOverrides([]);
    }
  };

  const toggleOverride = (feature: string) => {
    setEditOverrides((prev) =>
      prev.includes(feature)
        ? prev.filter((f) => f !== feature)
        : [...prev, feature]
    );
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/workspaces/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          plan: editPlan,
          feature_overrides: JSON.stringify(editOverrides),
        }),
      });
      // Update local state
      setWorkspaces((prev) =>
        prev.map((ws) =>
          ws.id === selected.id
            ? { ...ws, plan: editPlan, feature_overrides: JSON.stringify(editOverrides) }
            : ws
        )
      );
      setSelected((prev) =>
        prev ? { ...prev, plan: editPlan, feature_overrides: JSON.stringify(editOverrides) } : null
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
              <select value={editPlan} onChange={(e) => setEditPlan(e.target.value)}>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
              </select>
            </div>

            <div className="admin-detail-field">
              <label>Feature Overrides</label>
              <div className="admin-feature-list">
                {ALL_FEATURES.map((feature) => (
                  <label key={feature} className="admin-feature-item">
                    <input
                      type="checkbox"
                      checked={editOverrides.includes(feature)}
                      onChange={() => toggleOverride(feature)}
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
