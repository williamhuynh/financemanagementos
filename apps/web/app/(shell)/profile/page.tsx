"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHead } from "@tandemly/ui";
import { useAuth } from "../../../lib/auth-context";

type ActionState = "idle" | "working" | "error";
type DeleteError = string | null;

function parseUserName(name: string | undefined | null) {
  if (!name || !name.trim()) {
    return { firstName: "", lastName: "" };
  }
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [signOutState, setSignOutState] = useState<ActionState>("idle");
  const [exportState, setExportState] = useState<ActionState>("idle");
  const [deleteState, setDeleteState] = useState<ActionState>("idle");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<DeleteError>(null);

  const { firstName, lastName } = parseUserName(user?.name);
  const initials =
    (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "?";

  const handleSignOut = async () => {
    setSignOutState("working");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setSignOutState("error");
    }
  };

  const handleExport = async () => {
    setExportState("working");
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `tandemly-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportState("idle");
    } catch {
      setExportState("error");
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== "DELETE") return;

    setDeleteState("working");
    setDeleteError(null);
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          data.error || "Deletion failed. Please try again."
        );
      }
      router.replace("/login");
    } catch (err) {
      setDeleteState("error");
      setDeleteError(
        err instanceof Error ? err.message : "Deletion failed. Please try again."
      );
    }
  };

  return (
    <>
      <SectionHead
        title="Profile"
      />
      <div className="profile-card">
        <div className="profile-avatar-large" aria-hidden="true">
          {initials}
        </div>
        <div className="profile-info">
          <div className="profile-field">
            <span className="profile-label">First name</span>
            <span className="profile-value">{firstName || "\u2014"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Last name</span>
            <span className="profile-value">{lastName || "\u2014"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user?.email || "\u2014"}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button
            className="ghost-btn"
            type="button"
            onClick={handleExport}
            disabled={exportState === "working"}
          >
            {exportState === "working"
              ? "Exporting\u2026"
              : exportState === "error"
                ? "Export failed \u2014 retry"
                : "Export my data"}
          </button>
          <button
            className="ghost-btn danger-btn"
            type="button"
            onClick={handleSignOut}
            disabled={signOutState === "working"}
          >
            {signOutState === "working" ? "Signing out\u2026" : "Sign out"}
          </button>
          {signOutState === "error" && (
            <div className="row-sub">
              We could not sign you out. Try again.
            </div>
          )}
        </div>
      </div>

      <div className="profile-card" style={{ marginTop: 24, borderColor: "rgba(226, 106, 90, 0.3)" }}>
        <div className="profile-info">
          <div className="profile-field">
            <span className="profile-label" style={{ color: "var(--liability)" }}>
              Danger zone
            </span>
            <span className="profile-value" style={{ fontSize: 14 }}>
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </span>
          </div>
        </div>
        <div className="profile-actions">
          {!showDeleteConfirm ? (
            <button
              className="ghost-btn danger-btn"
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete my account
            </button>
          ) : (
            <div style={{ display: "grid", gap: 12, width: "100%" }}>
              <p className="row-sub">
                Type <strong>DELETE</strong> to confirm account deletion.
              </p>
              <input
                className="text-input"
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoFocus
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  className="danger-btn ghost-btn"
                  type="button"
                  onClick={handleDelete}
                  disabled={
                    deleteConfirmText !== "DELETE" ||
                    deleteState === "working"
                  }
                >
                  {deleteState === "working"
                    ? "Deleting\u2026"
                    : "Permanently delete"}
                </button>
                <button
                  className="ghost-btn"
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText("");
                  }}
                >
                  Cancel
                </button>
              </div>
              {deleteState === "error" && deleteError && (
                <div className="row-sub" style={{ color: "var(--liability)" }}>
                  {deleteError}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
