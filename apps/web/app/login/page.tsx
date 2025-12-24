"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Account, ID } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

type FormState = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
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
      const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
      await account.createMagicURLSession(ID.unique(), email, callbackUrl);
      setFormState("sent");
      setStatusMessage("Check your email for the sign-in link.");
    } catch (error) {
      setFormState("error");
      setStatusMessage("We could not send the magic link. Please try again.");
    }
  };

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-sub">We will email you a secure magic link.</p>
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
          <button className="primary-btn" type="submit" disabled={formState === "sending"}>
            {formState === "sending" ? "Sending link..." : "Send magic link"}
          </button>
        </form>
        {statusMessage ? (
          <p className={formState === "sent" ? "auth-success" : "auth-error"}>
            {statusMessage}
          </p>
        ) : null}
        <p className="auth-hint">
          Use your registered email. The link stays valid for a short time.
        </p>
      </div>
    </div>
  );
}
