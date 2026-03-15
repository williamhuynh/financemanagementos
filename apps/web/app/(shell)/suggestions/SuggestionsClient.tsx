"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@tandemly/ui";
import { apiFetch } from "../../../lib/api-fetch";

type Suggestion = {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string;
  title: string;
  description: string;
  status: "new" | "approved" | "in_progress" | "done";
  upvote_count: number;
  has_upvoted: boolean;
  created_at: string;
  updated_at: string;
};

const STATUS_COLUMNS: { key: Suggestion["status"]; label: string }[] = [
  { key: "new", label: "New" },
  { key: "approved", label: "Approved" },
  { key: "in_progress", label: "In Progress" },
  { key: "done", label: "Done" },
];

type SuggestionsClientProps = {
  userId: string;
};

export default function SuggestionsClient({ userId }: SuggestionsClientProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // New suggestion form
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete state — confirmDeleteId is set on first click; second click confirms
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Upvote in-flight
  const [upvotingId, setUpvotingId] = useState<string | null>(null);

  const fetchSuggestions = useCallback(async () => {
    try {
      const res = await apiFetch("/api/suggestions", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setSuggestions(data.suggestions || []);
    } catch {
      setError("Failed to load suggestions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  function clearMessages() {
    setError(null);
    setSuccessMessage(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      const res = await apiFetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: newTitle, description: newDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create suggestion");
        return;
      }
      setSuggestions((prev) => [data.suggestion, ...prev]);
      setNewTitle("");
      setNewDescription("");
      setShowForm(false);
      setSuccessMessage("Suggestion submitted!");
    } catch {
      setError("Failed to create suggestion");
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(s: Suggestion) {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditDescription(s.description);
    clearMessages();
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditDescription("");
  }

  async function handleEdit(id: string) {
    clearMessages();
    setEditSaving(true);
    try {
      const res = await apiFetch(`/api/suggestions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title: editTitle, description: editDescription }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save");
        return;
      }
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? data.suggestion : s))
      );
      cancelEdit();
      setSuccessMessage("Suggestion updated.");
    } catch {
      setError("Failed to save suggestion");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    clearMessages();
    setDeletingId(id);
    try {
      const res = await apiFetch(`/api/suggestions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
      setSuccessMessage("Suggestion deleted.");
    } catch {
      setError("Failed to delete suggestion");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleUpvote(s: Suggestion) {
    if (upvotingId) return;
    setUpvotingId(s.id);
    const newUpvote = !s.has_upvoted;
    // Optimistic update
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === s.id
          ? {
              ...item,
              has_upvoted: newUpvote,
              upvote_count: item.upvote_count + (newUpvote ? 1 : -1),
            }
          : item
      )
    );
    try {
      const res = await apiFetch(`/api/suggestions/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ upvote: newUpvote }),
      });
      if (!res.ok) {
        // Revert on failure
        setSuggestions((prev) =>
          prev.map((item) =>
            item.id === s.id ? { ...item, has_upvoted: s.has_upvoted, upvote_count: s.upvote_count } : item
          )
        );
      }
    } catch {
      // Revert on failure
      setSuggestions((prev) =>
        prev.map((item) =>
          item.id === s.id ? { ...item, has_upvoted: s.has_upvoted, upvote_count: s.upvote_count } : item
        )
      );
    } finally {
      setUpvotingId(null);
    }
  }

  const byStatus = (status: Suggestion["status"]) =>
    suggestions.filter((s) => s.status === status);

  return (
    <div className="suggestions-page">
      {error && <div className="form-error">{error}</div>}
      {successMessage && <div className="form-success">{successMessage}</div>}

      <div className="suggestions-actions">
        {!showForm ? (
          <button className="primary-btn" onClick={() => { setShowForm(true); clearMessages(); }}>
            + New Suggestion
          </button>
        ) : (
          <Card title="New Suggestion">
            <form onSubmit={handleCreate} className="suggestion-new-form">
              <div className="form-field">
                <label>Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Brief title..."
                  maxLength={200}
                  required
                  autoFocus
                />
              </div>
              <div className="form-field">
                <label>Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe your suggestion..."
                  maxLength={2000}
                  rows={4}
                  required
                />
              </div>
              <div className="form-row">
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit"}
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => { setShowForm(false); setNewTitle(""); setNewDescription(""); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </Card>
        )}
      </div>

      {loading ? (
        <div className="suggestions-loading">Loading suggestions…</div>
      ) : (
        <div className="suggestions-board">
          {STATUS_COLUMNS.map(({ key, label }) => (
            <div key={key} className="suggestions-column" data-status={key}>
              <div className="suggestions-column-header">
                <span className="suggestions-column-title">{label}</span>
                <span className="suggestions-column-count">{byStatus(key).length}</span>
              </div>
              <div className="suggestions-column-cards">
                {byStatus(key).length === 0 && (
                  <div className="suggestions-empty">No suggestions yet</div>
                )}
                {byStatus(key).map((s) => (
                  <div key={s.id} className="suggestion-card">
                    {editingId === s.id ? (
                      <div className="suggestion-edit-form">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          maxLength={200}
                          className="suggestion-edit-input"
                        />
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          maxLength={2000}
                          rows={3}
                          className="suggestion-edit-textarea"
                        />
                        <div className="suggestion-edit-actions">
                          <button
                            className="primary-btn small-btn"
                            onClick={() => handleEdit(s.id)}
                            disabled={editSaving}
                          >
                            {editSaving ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="secondary-btn small-btn"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="suggestion-card-title">{s.title}</div>
                        <div className="suggestion-card-desc">{s.description}</div>
                        <div className="suggestion-card-meta">
                          <span className="suggestion-card-author">{s.user_name}</span>
                        </div>
                        <div className="suggestion-card-actions">
                          <button
                            className={`upvote-btn${s.has_upvoted ? " upvoted" : ""}`}
                            onClick={() => handleUpvote(s)}
                            disabled={upvotingId === s.id}
                            title={s.has_upvoted ? "Remove upvote" : "Upvote"}
                          >
                            ▲ {s.upvote_count}
                          </button>
                          {s.user_id === userId && (
                            <>
                              <button
                                className="secondary-btn small-btn"
                                onClick={() => startEdit(s)}
                              >
                                Edit
                              </button>
                              {confirmDeleteId === s.id ? (
                                <>
                                  <button
                                    className="danger-btn small-btn"
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                  >
                                    {deletingId === s.id ? "Deleting..." : "Confirm"}
                                  </button>
                                  <button
                                    className="secondary-btn small-btn"
                                    onClick={() => setConfirmDeleteId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="danger-btn small-btn"
                                  onClick={() => setConfirmDeleteId(s.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
