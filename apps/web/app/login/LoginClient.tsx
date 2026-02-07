"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type FormState = "idle" | "sending" | "error";

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const nextPath = useMemo(() => {
    const candidate = searchParams.get("next");
    if (candidate && candidate.startsWith("/")) {
      return candidate;
    }
    return "/dashboard";
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setFormState("error");
      setStatusMessage("Enter the email you want to sign in with.");
      return;
    }
    if (!password) {
      setFormState("error");
      setStatusMessage("Enter your password.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      // Use server-side session API for Appwrite Cloud compatibility
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error("Login failed");
      }

      // Session stored server-side - secure HttpOnly cookie set automatically
      router.replace(nextPath);
    } catch (error) {
      setFormState("error");
      setStatusMessage("Email or password is incorrect. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Tandemly</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">Enter your email and password to sign in.</p>
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
          <label className="field">
            <span className="field-label">Password</span>
            <input
              className="field-input"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button className="primary-btn" type="submit" disabled={formState === "sending"}>
            {formState === "sending" ? "Signing in..." : "Sign in"}
          </button>
        </form>
        {statusMessage ? (
          <p className="auth-error">{statusMessage}</p>
        ) : null}
        <p className="auth-hint">
          <Link href="/forgot-password" className="auth-link">
            Forgot your password?
          </Link>
        </p>
        <p className="auth-hint">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="auth-link">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
