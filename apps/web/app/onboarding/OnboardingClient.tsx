"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // Check session and get user info from server
    const checkSession = async () => {
      try {
        const response = await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
          router.replace("/login");
          return;
        }

        const data = await response.json();
        if (data.authenticated && data.user) {
          setUserName(data.user.name || "");
          // Default workspace name to "{Name}'s Workspace"
          if (data.user.name) {
            setWorkspaceName(`${data.user.name}'s Workspace`);
          }
          setIsCheckingAuth(false);
        } else {
          router.replace("/login");
        }
      } catch (error) {
        router.replace("/login");
      }
    };

    checkSession();
  }, [router]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // Use server-side session API
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      // Session destroyed server-side
      router.replace("/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

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
      // Session cookie sent automatically by the browser
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: 'include', // Ensure cookies are included
        body: JSON.stringify({
          name: finalName,
          currency
        })
      });

      if (response.status === 401) {
        setFormState("error");
        setStatusMessage("Your session has expired. Please log out and log back in to continue.");
        return;
      }

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
        <div className="eyebrow">Tandemly</div>
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
        <p className="auth-hint" style={{ marginTop: "var(--space-4)" }}>
          Having issues?{" "}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="auth-link"
            style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            {isLoggingOut ? "Logging out..." : "Log out"}
          </button>
        </p>
      </div>
    </div>
  );
}
