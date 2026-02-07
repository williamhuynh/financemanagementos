"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
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

  // Derive auth state directly — no useState avoids the stale "loading" flash
  // on mount and on every soft navigation.
  const authState = useMemo<AuthState>(() => {
    if (!appwriteEnabled) return "authed";
    if (authLoading) return "loading";
    if (!user) return "guest";
    // User is authenticated — don't block content on workspace loading.
    // Only check onboarding once workspaces have actually loaded.
    if (!workspaceLoading && needsOnboarding) return "needs-onboarding";
    return "authed";
  }, [authLoading, user, workspaceLoading, needsOnboarding]);

  const nextPath = useMemo(() => {
    if (!pathname || !pathname.startsWith("/")) {
      return "/dashboard";
    }
    return pathname;
  }, [pathname]);

  // Handle redirects as side effects
  useEffect(() => {
    if (authState === "guest") {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
    } else if (authState === "needs-onboarding") {
      router.replace("/onboarding");
    }
  }, [authState, nextPath, router]);

  if (authState === "authed") {
    return <>{children}</>;
  }

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
