"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { SectionHead } from "@tandemly/ui";
import { useAuth } from "../../../../lib/auth-context";
import { apiFetch } from "../../../../lib/api-fetch";

type SectionState = "idle" | "saving" | "success" | "error";

function parseUserName(name: string | undefined | null) {
  if (!name || !name.trim()) return { firstName: "", lastName: "" };
  const parts = name.trim().split(/\s+/);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export default function EditProfilePage() {
  const { user, refreshAuth } = useAuth();
  const router = useRouter();

  const { firstName, lastName } = parseUserName(user?.name);

  const [nameFirst, setNameFirst] = useState(firstName);
  const [nameLast, setNameLast] = useState(lastName);
  const [nameState, setNameState] = useState<SectionState>("idle");
  const [nameError, setNameError] = useState("");

  const [newEmail, setNewEmail] = useState(user?.email ?? "");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailState, setEmailState] = useState<SectionState>("idle");
  const [emailError, setEmailError] = useState("");
  const [emailVerificationSent, setEmailVerificationSent] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordState, setPasswordState] = useState<SectionState>("idle");
  const [passwordError, setPasswordError] = useState("");

  const handleNameSave = async (e: FormEvent) => {
    e.preventDefault();
    const fullName = [nameFirst.trim(), nameLast.trim()].filter(Boolean).join(" ");
    if (!fullName) {
      setNameError("Name is required.");
      return;
    }
    setNameState("saving");
    setNameError("");
    try {
      const res = await apiFetch("/api/account/profile?action=name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed.");
      }
      await refreshAuth();
      setNameState("success");
    } catch (err) {
      setNameState("error");
      setNameError(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const handleEmailSave = async (e: FormEvent) => {
    e.preventDefault();
    setEmailState("saving");
    setEmailError("");
    try {
      const res = await apiFetch("/api/account/profile?action=email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, password: emailPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Update failed.");
      }
      await refreshAuth();
      setEmailPassword("");
      setEmailVerificationSent(data.emailVerificationSent === true);
      setEmailState("success");
    } catch (err) {
      setEmailState("error");
      setEmailError(err instanceof Error ? err.message : "Update failed.");
    }
  };

  const handlePasswordSave = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordState("saving");
    setPasswordError("");
    try {
      const res = await apiFetch("/api/account/profile?action=password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword, oldPassword }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Update failed.");
      }
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordState("success");
    } catch (err) {
      setPasswordState("error");
      setPasswordError(err instanceof Error ? err.message : "Update failed.");
    }
  };

  return (
    <>
      <SectionHead title="Edit Profile" />

      {/* Name */}
      <div className="profile-card" style={{ maxWidth: 480, width: "100%" }}>
        <div className="profile-info">
          <span className="profile-label">Display name</span>
        </div>
        <form onSubmit={handleNameSave} style={{ width: "100%", display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input
              className="text-input"
              type="text"
              placeholder="First name"
              value={nameFirst}
              onChange={(e) => { setNameFirst(e.target.value); setNameState("idle"); }}
              required
            />
            <input
              className="text-input"
              type="text"
              placeholder="Last name"
              value={nameLast}
              onChange={(e) => { setNameLast(e.target.value); setNameState("idle"); }}
            />
          </div>
          {nameState === "success" && (
            <div className="auth-success">Name updated.</div>
          )}
          {nameState === "error" && nameError && (
            <div className="auth-error">{nameError}</div>
          )}
          <div className="form-actions">
            <button
              className="ghost-btn"
              type="submit"
              disabled={nameState === "saving"}
            >
              {nameState === "saving" ? "Saving…" : "Save name"}
            </button>
          </div>
        </form>
      </div>

      {/* Email */}
      <div className="profile-card" style={{ maxWidth: 480, width: "100%", marginTop: 20 }}>
        <div className="profile-info">
          <span className="profile-label">Email address</span>
          <span className="profile-value" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
            Changing your email will require re-verification.
          </span>
        </div>
        <form onSubmit={handleEmailSave} style={{ width: "100%", display: "grid", gap: 12 }}>
          <input
            className="text-input"
            type="email"
            placeholder="New email address"
            value={newEmail}
            onChange={(e) => { setNewEmail(e.target.value); setEmailState("idle"); }}
            required
          />
          <input
            className="text-input"
            type="password"
            placeholder="Current password to confirm"
            value={emailPassword}
            onChange={(e) => { setEmailPassword(e.target.value); setEmailState("idle"); }}
            required
          />
          {emailState === "success" && (
            <div className="auth-success">
              {emailVerificationSent
                ? "Email updated. Check your inbox to re-verify."
                : "Email updated. Please request a new verification email from your profile."}
            </div>
          )}
          {emailState === "error" && emailError && (
            <div className="auth-error">{emailError}</div>
          )}
          <div className="form-actions">
            <button
              className="ghost-btn"
              type="submit"
              disabled={emailState === "saving"}
            >
              {emailState === "saving" ? "Saving…" : "Save email"}
            </button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="profile-card" style={{ maxWidth: 480, width: "100%", marginTop: 20 }}>
        <div className="profile-info">
          <span className="profile-label">Password</span>
        </div>
        <form onSubmit={handlePasswordSave} style={{ width: "100%", display: "grid", gap: 12 }}>
          <input
            className="text-input"
            type="password"
            placeholder="Current password"
            value={oldPassword}
            onChange={(e) => { setOldPassword(e.target.value); setPasswordState("idle"); }}
            required
          />
          <input
            className="text-input"
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => { setNewPassword(e.target.value); setPasswordState("idle"); }}
            required
            minLength={8}
          />
          <input
            className="text-input"
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => { setConfirmPassword(e.target.value); setPasswordState("idle"); }}
            required
          />
          {passwordState === "success" && (
            <div className="auth-success">Password changed.</div>
          )}
          {passwordState === "error" && passwordError && (
            <div className="auth-error">{passwordError}</div>
          )}
          <div className="form-actions">
            <button
              className="ghost-btn"
              type="submit"
              disabled={passwordState === "saving"}
            >
              {passwordState === "saving" ? "Saving…" : "Change password"}
            </button>
          </div>
        </form>
      </div>

      {/* Back */}
      <div style={{ maxWidth: 480, width: "100%", marginTop: 20 }}>
        <Link href="/profile" className="ghost-btn" style={{ display: "inline-block" }}>
          ← Back to profile
        </Link>
      </div>
    </>
  );
}
