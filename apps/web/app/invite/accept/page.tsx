"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth-context";

type InvitationInfo = {
  email: string;
  role: string;
  workspace_name: string;
  expires_at: string;
};

function AcceptInvitationContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [invitation, setInvitation] = useState<InvitationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    async function verifyToken() {
      if (!token) {
        setError("No invitation token provided");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/invitations/verify?token=${token}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Invalid invitation");
          return;
        }

        setInvitation(data.invitation);
      } catch {
        setError("Failed to verify invitation");
      } finally {
        setLoading(false);
      }
    }

    verifyToken();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;

    setAccepting(true);
    setError(null);

    try {
      const response = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      // Redirect to dashboard
      router.push("/dashboard");
    } catch {
      setError("Failed to accept invitation");
    } finally {
      setAccepting(false);
    }
  };

  const handleSignIn = () => {
    // Preserve the token in the redirect
    router.push(`/signin?redirect=/invite/accept?token=${token}`);
  };

  const handleSignUp = () => {
    // Preserve the token in the redirect
    router.push(`/signup?redirect=/invite/accept?token=${token}`);
  };

  if (loading || authLoading) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Verifying Invitation...</h1>
          <p className="auth-sub">Please wait while we verify your invitation.</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">Invalid Invitation</h1>
          <p className="auth-error">{error}</p>
          <p className="auth-hint">
            This invitation may have expired or already been used.
          </p>
          <button
            className="primary-btn"
            style={{ marginTop: "20px", width: "100%" }}
            onClick={() => router.push("/signin")}
          >
            Go to Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Workspace Invitation</h1>
        <p className="auth-sub">
          You've been invited to join <strong>{invitation.workspace_name}</strong>
        </p>

        <div className="invitation-details">
          <div className="invitation-row">
            <span className="invitation-label">Role:</span>
            <span className="invitation-value">{invitation.role}</span>
          </div>
          <div className="invitation-row">
            <span className="invitation-label">Invited email:</span>
            <span className="invitation-value">{invitation.email}</span>
          </div>
        </div>

        {error && <p className="auth-error">{error}</p>}

        {user ? (
          <>
            {user.email.toLowerCase() === invitation.email.toLowerCase() ? (
              <button
                className="primary-btn"
                style={{ marginTop: "20px", width: "100%" }}
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? "Accepting..." : "Accept Invitation"}
              </button>
            ) : (
              <div>
                <p className="auth-error" style={{ marginTop: "16px" }}>
                  This invitation was sent to {invitation.email}, but you are
                  signed in as {user.email}.
                </p>
                <p className="auth-hint">
                  Please sign in with the correct account to accept this invitation.
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="invitation-auth-options">
            <p className="auth-hint" style={{ marginBottom: "16px" }}>
              Sign in or create an account to accept this invitation.
            </p>
            <button
              className="primary-btn"
              style={{ width: "100%", marginBottom: "12px" }}
              onClick={handleSignIn}
            >
              Sign In
            </button>
            <button
              className="secondary-btn"
              style={{ width: "100%" }}
              onClick={handleSignUp}
            >
              Create Account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Loading...</h1>
        <p className="auth-sub">Please wait...</p>
      </div>
    </div>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <AcceptInvitationContent />
    </Suspense>
  );
}
