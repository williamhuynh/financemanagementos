"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type PageState = "verifying" | "success" | "error" | "no-params";

export default function VerifyEmailClient() {
  const searchParams = useSearchParams();
  const userId = useMemo(() => searchParams.get("userId") || "", [searchParams]);
  const secret = useMemo(() => searchParams.get("secret") || "", [searchParams]);

  const [pageState, setPageState] = useState<PageState>(
    userId && secret ? "verifying" : "no-params"
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!userId || !secret) return;

    const verify = async () => {
      try {
        const response = await fetch("/api/auth/verify-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", userId, secret }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Verification failed");
        }

        setPageState("success");
        setMessage("Your email has been verified successfully.");
      } catch (error: unknown) {
        setPageState("error");
        if (error instanceof Error) {
          setMessage(error.message);
        } else {
          setMessage("Verification failed. The link may have expired.");
        }
      }
    };

    verify();
  }, [userId, secret]);

  if (pageState === "verifying") {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="eyebrow">FinanceLab</div>
          <h1 className="auth-title">Verifying email...</h1>
          <p className="auth-sub">Please wait while we verify your email address.</p>
        </div>
      </div>
    );
  }

  if (pageState === "success") {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="eyebrow">FinanceLab</div>
          <h1 className="auth-title">Email verified</h1>
          <p className="auth-success">{message}</p>
          <p className="auth-hint">
            <Link href="/dashboard" className="auth-link">
              Go to dashboard
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="auth-page">
        <div className="card auth-card">
          <div className="eyebrow">FinanceLab</div>
          <h1 className="auth-title">Verification failed</h1>
          <p className="auth-error">{message}</p>
          <p className="auth-hint">
            <Link href="/dashboard" className="auth-link">
              Go to dashboard
            </Link>{" "}
            to request a new verification email.
          </p>
        </div>
      </div>
    );
  }

  // no-params state
  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Email verification</h1>
        <p className="auth-sub">
          Check your inbox for a verification link, or go to your dashboard to request a new one.
        </p>
        <p className="auth-hint">
          <Link href="/dashboard" className="auth-link">
            Go to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
