"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Account } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";
import { isAllowedEmail } from "../../lib/auth";
import { useAuth } from "../../lib/auth-context";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState = "loading" | "authed" | "guest";

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [authState, setAuthState] = useState<AuthState>("loading");

  const nextPath = useMemo(() => {
    if (!pathname || !pathname.startsWith("/")) {
      return "/dashboard";
    }
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (loading) {
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

    if (!isAllowedEmail(user.email)) {
      setAuthState("guest");
      const appwrite = getAppwriteClient();
      if (appwrite) {
        const account = new Account(appwrite.client);
        account
          .deleteSession("current")
          .catch(() => null)
          .finally(() => {
            router.replace("/login?error=unauthorized");
          });
      } else {
        router.replace("/login?error=unauthorized");
      }
      return;
    }

    setAuthState("authed");
  }, [user, loading, router, nextPath]);

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
