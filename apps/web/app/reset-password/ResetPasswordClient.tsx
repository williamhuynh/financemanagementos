"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type FormState = "idle" | "sending" | "success" | "error";

export default function ResetPasswordClient() {
  const searchParams = useSearchParams();
  const userId = useMemo(() => searchParams.get("userId") || "", [searchParams]);
  const secret = useMemo(() => searchParams.get("secret") || "", [searchParams]);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const isValidLink = Boolean(userId && secret);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!password) {
      setFormState("error");
      setStatusMessage("Enter a new password.");
      return;
    }
    if (password.length < 8) {
      setFormState("error");
      setStatusMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormState("error");
      setStatusMessage("Passwords do not match.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, secret, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setFormState("success");
      setStatusMessage("Your password has been reset successfully.");
    } catch (error: unknown) {
      setFormState("error");
      if (error instanceof Error) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Failed to reset password. Please try again.");
      }
    }
  };

  if (!isValidLink) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="eyebrow">Tandemly</div>
          <h1 className="auth-title">Invalid link</h1>
          <p className="auth-sub">
            This password reset link is invalid or has expired.
          </p>
          <p className="auth-hint">
            <Link href="/forgot-password" className="auth-link">
              Request a new recovery link
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (formState === "success") {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="eyebrow">Tandemly</div>
          <h1 className="auth-title">Password reset</h1>
          <p className="auth-success">{statusMessage}</p>
          <p className="auth-hint">
            <Link href="/login" className="auth-link">
              Sign in with your new password
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Tandemly</div>
        <h1 className="auth-title">Set new password</h1>
        <p className="auth-sub">Enter your new password below.</p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">New password</span>
            <input
              className="field-input"
              type="password"
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input
              className="field-input"
              type="password"
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>
          <button
            className="primary-btn"
            type="submit"
            disabled={formState === "sending"}
          >
            {formState === "sending" ? "Resetting..." : "Reset password"}
          </button>
        </form>
        {statusMessage && formState === "error" ? (
          <p className="auth-error">{statusMessage}</p>
        ) : null}
      </div>
    </div>
  );
}
