"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Account } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

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

  useEffect(() => {
    if (!appwriteEnabled) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    const account = new Account(appwrite.client);
    account
      .get()
      .then(() => router.replace(nextPath))
      .catch(() => {
        setFormState("idle");
      });
  }, [router, nextPath]);

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

    if (!appwriteEnabled) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setFormState("error");
      setStatusMessage("Appwrite auth is not configured yet.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      const account = new Account(appwrite.client);
      await account.createEmailPasswordSession(email, password);
      // Session created successfully, redirect
      router.replace(nextPath);
    } catch (error) {
      setFormState("error");
      setStatusMessage("Email or password is incorrect. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
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
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="auth-link">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
