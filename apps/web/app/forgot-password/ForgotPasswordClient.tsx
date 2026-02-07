"use client";

import { useState } from "react";
import Link from "next/link";

type FormState = "idle" | "sending" | "sent" | "error";

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email) {
      setFormState("error");
      setStatusMessage("Enter your email address.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      setFormState("sent");
      setStatusMessage(
        data.message || "If an account with that email exists, a recovery link has been sent."
      );
    } catch {
      setFormState("sent");
      setStatusMessage("If an account with that email exists, a recovery link has been sent.");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Reset password</h1>
        <p className="auth-sub">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        {formState === "sent" ? (
          <>
            <p className="auth-success">{statusMessage}</p>
            <p className="auth-hint">
              <Link href="/login" className="auth-link">
                Back to sign in
              </Link>
            </p>
          </>
        ) : (
          <>
            <form onSubmit={handleSubmit}>
              <label className="field">
                <span className="field-label">Email address</span>
                <input
                  className="field-input"
                  type="email"
                  name="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </label>
              <button
                className="primary-btn"
                type="submit"
                disabled={formState === "sending"}
              >
                {formState === "sending" ? "Sending..." : "Send recovery link"}
              </button>
            </form>
            {statusMessage && formState === "error" ? (
              <p className="auth-error">{statusMessage}</p>
            ) : null}
            <p className="auth-hint">
              Remember your password?{" "}
              <Link href="/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
