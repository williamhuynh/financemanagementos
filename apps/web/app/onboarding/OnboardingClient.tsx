"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Account } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

type FormState = "idle" | "sending" | "error";

const CURRENCIES = [
  { code: "AUD", name: "Australian Dollar", symbol: "$" },
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "\u20ac" },
  { code: "GBP", name: "British Pound", symbol: "\u00a3" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "$" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00a5" },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00a5" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20b9" }
];

export default function OnboardingClient() {
  const router = useRouter();
  const [userName, setUserName] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [currency, setCurrency] = useState("AUD");
  const [formState, setFormState] = useState<FormState>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Check if user is logged in and get their name
    if (!appwriteEnabled) {
      router.replace("/login");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      router.replace("/login");
      return;
    }

    const account = new Account(appwrite.client);
    account
      .get()
      .then((user) => {
        setUserName(user.name || "");
        // Default workspace name to "{Name}'s Workspace"
        if (user.name) {
          setWorkspaceName(`${user.name}'s Workspace`);
        }
        setIsCheckingAuth(false);
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const finalName = workspaceName.trim() || `${userName}'s Workspace`;

    if (!finalName) {
      setFormState("error");
      setStatusMessage("Please enter a workspace name.");
      return;
    }

    setFormState("sending");
    setStatusMessage(null);

    try {
      // Get the current session token
      const appwrite = getAppwriteClient();
      if (!appwrite) {
        throw new Error("Appwrite client not available");
      }

      const account = new Account(appwrite.client);
      const session = await account.getSession("current");

      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.secret}`
        },
        body: JSON.stringify({
          name: finalName,
          currency
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || "Failed to create workspace");
      }

      // Success - redirect to dashboard
      router.replace("/dashboard");
    } catch (error) {
      setFormState("error");
      if (error instanceof Error) {
        setStatusMessage(error.message);
      } else {
        setStatusMessage("Something went wrong. Please try again.");
      }
    }
  };

  if (isCheckingAuth) {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="card-title">Loading</div>
          <div className="card-sub">Setting up your account...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card" style={{ maxWidth: "480px" }}>
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Welcome{userName ? `, ${userName}` : ""}!</h1>
        <p className="auth-sub">
          Let&apos;s set up your workspace to start tracking your finances.
        </p>
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span className="field-label">Workspace name</span>
            <input
              className="field-input"
              type="text"
              name="workspaceName"
              placeholder={`${userName || "My"}'s Workspace`}
              value={workspaceName}
              onChange={(event) => setWorkspaceName(event.target.value)}
            />
            <span className="field-hint">
              Name your workspace (e.g., &quot;Family Finances&quot; or &quot;Personal Budget&quot;)
            </span>
          </label>
          <label className="field">
            <span className="field-label">Base currency</span>
            <select
              className="field-input"
              name="currency"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
            <span className="field-hint">
              Your primary currency for tracking and reports
            </span>
          </label>
          <button
            className="primary-btn"
            type="submit"
            disabled={formState === "sending"}
            style={{ marginTop: "var(--space-4)" }}
          >
            {formState === "sending" ? "Creating workspace..." : "Get started"}
          </button>
        </form>
        {statusMessage ? <p className="auth-error">{statusMessage}</p> : null}
      </div>
    </div>
  );
}
