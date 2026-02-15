"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@tandemly/ui";

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

function formatCurrency(value: number, currency = "AUD"): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export default function CategoriesClient({
  userRole,
}: CategoriesClientProps) {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<"income" | "expense">("expense");
  const [adding, setAdding] = useState(false);

  // Rename state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [remapTo, setRemapTo] = useState("");
  const [deleting, setDeleting] = useState(false);

  const currentMonth = getCurrentMonth();
  const canManage = userRole === "owner" || userRole === "admin";

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

  function startRename(cat: CategoryItem) {
    clearMessages();
    setEditingId(cat.id);
    setEditName(cat.name);
  }

  async function handleRename(cat: CategoryItem) {
    clearMessages();
    const trimmed = editName.trim();
    if (!trimmed || trimmed === cat.name) {
      setEditingId(null);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to rename");
        return;
      }
      setEditingId(null);
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

  async function handleGroupToggle(cat: CategoryItem) {
    clearMessages();
    const newGroupValue = cat.group === "income" ? "expense" : "income";
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
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

  function startDelete(cat: CategoryItem) {
    clearMessages();
    setDeletingId(cat.id);
    const uncategorised = categories.find(
      c => c.name === "Uncategorised" && c.id !== cat.id
    );
    setRemapTo(uncategorised?.name ?? "");
  }

  async function handleDelete(cat: CategoryItem) {
    clearMessages();
    if (!remapTo) {
      setError("Select a category to remap transactions to");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch(`/api/categories/${cat.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remap_to: remapTo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to delete");
        return;
      }
      setDeletingId(null);
      const countMsg = data.remapped_count > 0
        ? ` ${data.remapped_count} transaction${data.remapped_count === 1 ? "" : "s"} remapped to "${remapTo}".`
        : "";
      setSuccessMessage(`Category deleted.${countMsg}`);
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

  const deletingCategory = deletingId
    ? categories.find(c => c.id === deletingId)
    : null;

  function renderCategoryRow(cat: CategoryItem) {
    const isEditing = editingId === cat.id;
    const isDeleting = deletingId === cat.id;
    const spent = cat.month_spent ?? 0;

    return (
      <div key={cat.id} className="list-row">
        <div style={{ flex: 1 }}>
          {isEditing ? (
            <div className="form-row" style={{ gap: "8px" }}>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-input"
                style={{ flex: 1 }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename(cat);
                  if (e.key === "Escape") setEditingId(null);
                }}
              />
              <button
                type="button"
                className="primary-btn"
                disabled={saving}
                onClick={() => handleRename(cat)}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setEditingId(null)}
                style={{ padding: "6px 12px", fontSize: "13px" }}
              >
                Cancel
              </button>
            </div>
          ) : isDeleting && deletingCategory ? (
            <div>
              <div className="row-title">{cat.name}</div>
              <div className="row-sub" style={{ marginTop: "8px" }}>
                {cat.transaction_count > 0 ? (
                  <>
                    {cat.transaction_count} transaction{cat.transaction_count === 1 ? "" : "s"} will be remapped. Choose a replacement:
                    <select
                      value={remapTo}
                      onChange={(e) => setRemapTo(e.target.value)}
                      className="role-select"
                      style={{ marginTop: "4px", display: "block" }}
                    >
                      <option value="">Select category...</option>
                      {categories
                        .filter(c => c.id !== cat.id)
                        .map(c => (
                          <option key={c.id} value={c.name}>{c.name}</option>
                        ))}
                    </select>
                  </>
                ) : (
                  "No transactions use this category."
                )}
              </div>
              <div className="form-actions" style={{ marginTop: "8px" }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => setDeletingId(null)}
                  style={{ padding: "6px 12px", fontSize: "13px" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="ghost-btn danger"
                  disabled={deleting || (cat.transaction_count > 0 && !remapTo)}
                  onClick={() => handleDelete(cat)}
                  style={{ padding: "6px 12px", fontSize: "13px" }}
                >
                  {deleting ? "Deleting..." : cat.transaction_count > 0 ? "Remap & Delete" : "Delete"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="row-title">
                {cat.is_system && (
                  <span title="System category" style={{ marginRight: "6px", opacity: 0.5 }}>&#128274;</span>
                )}
                {cat.name}
              </div>
              <div className="row-sub">
                {canManage && !cat.is_system ? (
                  <button
                    type="button"
                    onClick={() => handleGroupToggle(cat)}
                    style={{
                      background: "none",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      padding: "1px 8px",
                      fontSize: "11px",
                      cursor: "pointer",
                      color: cat.group === "income" ? "var(--green)" : "var(--text-secondary)",
                      textTransform: "capitalize",
                    }}
                  >
                    {cat.group || "expense"}
                  </button>
                ) : (
                  <span style={{
                    fontSize: "11px",
                    color: cat.group === "income" ? "var(--green)" : "var(--text-secondary)",
                    textTransform: "capitalize",
                  }}>
                    {cat.group || "system"}
                  </span>
                )}
                {" "}
                <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                  {cat.transaction_count} transaction{cat.transaction_count === 1 ? "" : "s"}
                </span>
              </div>
            </>
          )}
        </div>
        {!isEditing && !isDeleting && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{
              fontSize: "13px",
              fontWeight: 500,
              fontVariantNumeric: "tabular-nums",
              color: spent > 0 ? "var(--text)" : "var(--text-secondary)",
              whiteSpace: "nowrap",
            }}>
              {spent !== 0 ? formatCurrency(Math.abs(spent)) : "--"}
            </span>
            {canManage && !cat.is_system && (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => startRename(cat)}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="ghost-btn danger"
                  onClick={() => startDelete(cat)}
                  disabled={nonSystemCount <= 1}
                  style={{ padding: "4px 8px", fontSize: "12px" }}
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {error && <p className="auth-error">{error}</p>}
      {successMessage && <p className="auth-success">{successMessage}</p>}

      <Card title="Expense" sub={`Spent in ${formatMonthLabel(currentMonth)}`}>
        {expenseCategories.length > 0 ? (
          expenseCategories.map(renderCategoryRow)
        ) : (
          <p className="loading-text">No expense categories</p>
        )}
      </Card>

      <Card title="Income" sub={`Received in ${formatMonthLabel(currentMonth)}`}>
        {incomeCategories.length > 0 ? (
          incomeCategories.map(renderCategoryRow)
        ) : (
          <p className="loading-text">No income categories</p>
        )}
      </Card>

      {systemCategories.length > 0 && (
        <Card title="System">
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
    </>
  );
}
