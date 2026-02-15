"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Card, DetailPanel } from "@tandemly/ui";
import { getLocaleForCurrency } from "../../../lib/currencies";

type CategoryItem = {
  id: string;
  name: string;
  group: "income" | "expense" | null;
  color: string | null;
  is_system: boolean;
  transaction_count: number;
  month_spent?: number;
};

type CategoriesClientProps = {
  workspaceId: string;
  userRole: string;
  homeCurrency: string;
};

function getCurrentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString("en-AU", { month: "long", year: "numeric" });
}

export default function CategoriesClient({
  userRole,
  homeCurrency,
}: CategoriesClientProps) {
  const formatCurrency = (value: number, currency?: string): string => {
    const cur = currency || homeCurrency;
    return new Intl.NumberFormat(getLocaleForCurrency(cur), {
      style: "currency",
      currency: cur,
      minimumFractionDigits: 2,
    }).format(value);
  };
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Detail panel selection
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<"income" | "expense">("expense");
  const [adding, setAdding] = useState(false);

  // Rename state (inside panel)
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state (inside panel)
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [remapTo, setRemapTo] = useState("");
  const [deleting, setDeleting] = useState(false);

  const currentMonth = getCurrentMonth();
  const canManage = userRole === "owner" || userRole === "admin";

  const selectedCategory = useMemo(() => {
    if (!selectedId) return null;
    return categories.find(c => c.id === selectedId) ?? null;
  }, [selectedId, categories]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`/api/categories?month=${currentMonth}`);
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch {
      setError("Failed to load categories");
    } finally {
      setLoading(false);
    }
  }, [currentMonth]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  function handleClosePanel() {
    setSelectedId(null);
    setEditingName(false);
    setConfirmingDelete(false);
  }

  const handleRowClick = useCallback((id: string) => {
    setSelectedId(prev => (prev === id ? null : id));
    setEditingName(false);
    setConfirmingDelete(false);
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

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setAdding(true);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, group: newGroup }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to add category");
        return;
      }
      setNewName("");
      setShowAddForm(false);
      setSuccessMessage(`Category "${data.category.name}" added.`);
      await fetchCategories();
    } catch {
      setError("Failed to add category");
    } finally {
      setAdding(false);
    }
  }

  async function handleRename() {
    if (!selectedCategory) return;
    clearMessages();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === selectedCategory.name) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to rename");
        return;
      }
      setEditingName(false);
      const countMsg = data.renamed_count > 0
        ? ` ${data.renamed_count} transaction${data.renamed_count === 1 ? "" : "s"} updated.`
        : "";
      setSuccessMessage(`Renamed.${countMsg}`);
      await fetchCategories();
    } catch {
      setError("Failed to rename category");
    } finally {
      setSaving(false);
    }
  }

  async function handleGroupToggle() {
    if (!selectedCategory) return;
    clearMessages();
    const newGroupValue = selectedCategory.group === "income" ? "expense" : "income";
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ group: newGroupValue }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update group");
        return;
      }
      await fetchCategories();
    } catch {
      setError("Failed to update group");
    }
  }

  async function handleDelete() {
    if (!selectedCategory) return;
    clearMessages();
    if (selectedCategory.transaction_count > 0 && !remapTo) {
      setError("Select a category to remap transactions to");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remap_to: remapTo || "Uncategorised" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        return;
      }
      const countMsg = data.remapped_count > 0
        ? ` ${data.remapped_count} transaction${data.remapped_count === 1 ? "" : "s"} remapped to "${remapTo}".`
        : "";
      setSuccessMessage(`Category deleted.${countMsg}`);
      handleClosePanel();
      await fetchCategories();
    } catch {
      setError("Failed to delete category");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <Card title="Categories">
        <p className="loading-text">Loading categories...</p>
      </Card>
    );
  }

  const expenseCategories = categories.filter(c => c.group === "expense" || (!c.group && !c.is_system));
  const incomeCategories = categories.filter(c => c.group === "income");
  const systemCategories = categories.filter(c => c.is_system);
  const nonSystemCount = categories.filter(c => !c.is_system).length;

  function renderCategoryRow(cat: CategoryItem) {
    const spent = cat.month_spent ?? 0;
    const isSelected = selectedId === cat.id;

    return (
      <div
        key={cat.id}
        className={`list-row${isSelected ? " selected" : ""}`}
        onClick={() => handleRowClick(cat.id)}
        onKeyDown={(e) => handleRowKeyDown(e, cat.id)}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        <div className="cat-row-label">
          {cat.is_system && (
            <span title="System category" style={{ opacity: 0.5 }}>&#128274;</span>
          )}
          <span className="cat-row-name">{cat.name}</span>
          <span className="cat-row-count">
            {cat.transaction_count}
          </span>
        </div>
        <div className="cat-row-right">
          <span className="cat-row-amount" data-has-value={spent !== 0 ? "" : undefined}>
            {spent !== 0 ? formatCurrency(Math.abs(spent)) : "--"}
          </span>
        </div>
      </div>
    );
  }

  function renderPanelContent() {
    if (!selectedCategory) return null;
    const spent = selectedCategory.month_spent ?? 0;

    return (
      <>
        <div className="right-drawer-detail">
          <span className="right-drawer-label">Name</span>
          {editingName ? (
            <div className="form-row" style={{ gap: "8px" }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-input"
                style={{ flex: 1 }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") setEditingName(false);
                }}
              />
              <button
                type="button"
                className="primary-btn"
                disabled={saving}
                onClick={handleRename}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setEditingName(false)}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <span className="right-drawer-value">{selectedCategory.name}</span>
          )}
        </div>

        <div className="right-drawer-detail">
          <span className="right-drawer-label">Group</span>
          <span className="right-drawer-value" style={{ textTransform: "capitalize" }}>
            {selectedCategory.group || (selectedCategory.is_system ? "system" : "expense")}
          </span>
        </div>

        <div className="right-drawer-detail">
          <span className="right-drawer-label">Transactions</span>
          <span className="right-drawer-value">
            {selectedCategory.transaction_count} transaction{selectedCategory.transaction_count === 1 ? "" : "s"}
          </span>
        </div>

        <div className="right-drawer-detail">
          <span className="right-drawer-label">{formatMonthLabel(currentMonth)}</span>
          <span className="right-drawer-value">
            {spent !== 0 ? formatCurrency(Math.abs(spent)) : "--"}
          </span>
        </div>

        {selectedCategory.is_system && (
          <div className="right-drawer-detail" style={{ marginTop: "8px" }}>
            <span className="right-drawer-value" style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              System categories cannot be modified.
            </span>
          </div>
        )}

        {canManage && !selectedCategory.is_system && (
          <div className="right-drawer-actions">
            {!editingName && (
              <button
                type="button"
                className="ghost-btn"
                onClick={() => {
                  setEditName(selectedCategory.name);
                  setEditingName(true);
                }}
                style={{ width: "100%" }}
              >
                Rename
              </button>
            )}

            <button
              type="button"
              className="ghost-btn"
              onClick={handleGroupToggle}
              style={{ width: "100%" }}
            >
              Move to {selectedCategory.group === "income" ? "Expense" : "Income"}
            </button>

            {!confirmingDelete ? (
              <div className="right-drawer-delete">
                <button
                  type="button"
                  className="ghost-btn danger"
                  onClick={() => {
                    setConfirmingDelete(true);
                    const uncategorised = categories.find(
                      c => c.name === "Uncategorised" && c.id !== selectedCategory.id
                    );
                    setRemapTo(uncategorised?.name ?? "");
                  }}
                  disabled={nonSystemCount <= 1}
                  style={{ width: "100%" }}
                >
                  Delete Category
                </button>
              </div>
            ) : (
              <div className="right-drawer-delete">
                {selectedCategory.transaction_count > 0 ? (
                  <div className="right-drawer-detail" style={{ marginBottom: "8px" }}>
                    <span className="right-drawer-label">
                      Remap {selectedCategory.transaction_count} transaction{selectedCategory.transaction_count === 1 ? "" : "s"} to
                    </span>
                    <select
                      value={remapTo}
                      onChange={(e) => setRemapTo(e.target.value)}
                      className="role-select"
                      style={{ width: "100%", marginTop: "4px" }}
                    >
                      <option value="">Select category...</option>
                      {categories
                        .filter(c => c.id !== selectedCategory.id)
                        .map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                  </div>
                ) : (
                  <div className="right-drawer-detail" style={{ marginBottom: "8px" }}>
                    <span className="right-drawer-value" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                      No transactions use this category.
                    </span>
                  </div>
                )}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => setConfirmingDelete(false)}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="ghost-btn danger"
                    disabled={deleting || (selectedCategory.transaction_count > 0 && !remapTo)}
                    onClick={handleDelete}
                    style={{ flex: 1 }}
                  >
                    {deleting ? "Deleting..." : selectedCategory.transaction_count > 0 ? "Remap & Delete" : "Delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      {successMessage && <p className="auth-success">{successMessage}</p>}

      <Card title="Expense" sub={`Spent in ${formatMonthLabel(currentMonth)}`} className="compact">
        {expenseCategories.length > 0 ? (
          expenseCategories.map(renderCategoryRow)
        ) : (
          <p className="loading-text">No expense categories</p>
        )}
      </Card>

      <Card title="Income" sub={`Received in ${formatMonthLabel(currentMonth)}`} className="compact">
        {incomeCategories.length > 0 ? (
          incomeCategories.map(renderCategoryRow)
        ) : (
          <p className="loading-text">No income categories</p>
        )}
      </Card>

      {systemCategories.length > 0 && (
        <Card title="System" className="compact">
          {systemCategories.map(renderCategoryRow)}
        </Card>
      )}

      {canManage && (
        <Card title="Add Category">
          {!showAddForm ? (
            <button
              className="primary-btn"
              type="button"
              onClick={() => {
                clearMessages();
                setShowAddForm(true);
              }}
            >
              Add Category
            </button>
          ) : (
            <form onSubmit={handleAdd} className="invite-form">
              <div className="form-row">
                <input
                  type="text"
                  placeholder="Category name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  maxLength={100}
                  className="text-input"
                  autoFocus
                />
                <select
                  value={newGroup}
                  onChange={(e) => setNewGroup(e.target.value as "income" | "expense")}
                  className="role-select"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="primary-btn"
                  disabled={adding}
                >
                  {adding ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          )}
        </Card>
      )}

      <DetailPanel
        open={!!selectedCategory}
        onClose={handleClosePanel}
        title="Category Details"
      >
        {renderPanelContent()}
      </DetailPanel>
    </>
  );
}
