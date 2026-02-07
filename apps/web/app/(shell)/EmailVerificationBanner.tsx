"use client";

import { useState } from "react";

type BannerProps = {
  emailVerified: boolean;
};

export default function EmailVerificationBanner({ emailVerified }: BannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");

  if (emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    setStatus("idle");
    try {
      const response = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      if (response.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="verification-banner">
      <span>
        Please verify your email address.{" "}
        {status === "sent" ? (
          <span>Verification email sent. Check your inbox.</span>
        ) : (
          <>
            <button
              className="ghost-btn"
              type="button"
              onClick={handleResend}
              disabled={sending}
            >
              {sending ? "Sending..." : "Resend verification email"}
            </button>
            {status === "error" ? (
              <span> Failed to send. Try again.</span>
            ) : null}
          </>
        )}
      </span>
      <button
        className="ghost-btn"
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
