"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { appwriteEnabled } from "../../lib/appwriteClient";
import { useAuth } from "../../lib/auth-context";
import { useWorkspace } from "../../lib/workspace-context";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState = "loading" | "authed" | "guest" | "needs-onboarding";

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading: authLoading } = useAuth();
  const { needsOnboarding, loading: workspaceLoading } = useWorkspace();
  const [authState, setAuthState] = useState<AuthState>("loading");

  const nextPath = useMemo(() => {
    if (!pathname || !pathname.startsWith("/")) {
      return "/dashboard";
    }
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (authLoading || workspaceLoading) {
      setAuthState("loading");
      return;
    }

    if (!appwriteEnabled) {
      setAuthState("authed");
      return;
    }

    if (!user) {
      setAuthState("guest");
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return;
    }

    // Check if user needs onboarding (no workspace)
    if (needsOnboarding) {
      setAuthState("needs-onboarding");
      router.replace("/onboarding");
      return;
    }

    // Authenticated user with workspace
    setAuthState("authed");
  }, [user, authLoading, workspaceLoading, needsOnboarding, router, nextPath]);

  if (authState === "loading" || authState === "needs-onboarding") {
    return (
      <div className="auth-loading">
        <div className="card">
          <div className="card-title">
            {authState === "needs-onboarding" ? "Setting up" : "Authenticating"}
          </div>
          <div className="card-sub">
            {authState === "needs-onboarding"
              ? "Preparing your workspace..."
              : "Checking your session..."}
          </div>
        </div>
      </div>
    );
  }

  if (authState !== "authed") {
    return (
      <div className="auth-loading">
        <div className="card">
          <div className="card-title">Authenticating</div>
          <div className="card-sub">Checking your session...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
