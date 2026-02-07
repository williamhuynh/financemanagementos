"use client";

import { useState } from "react";

type BannerProps = {
  emailVerified: boolean;
};

export default function EmailVerificationBanner({ emailVerified }: BannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  if (emailVerified || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setSending(true);
    try {
      await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send" }),
      });
      setSent(true);
    } catch {
      // Silently fail - user can try again
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="verification-banner">
      <span>
        Please verify your email address.{" "}
        {sent ? (
          <span>Verification email sent. Check your inbox.</span>
        ) : (
          <button
            className="ghost-btn"
            type="button"
            onClick={handleResend}
            disabled={sending}
          >
            {sending ? "Sending..." : "Resend verification email"}
          </button>
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
