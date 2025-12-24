"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Account } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../lib/appwriteClient";

type AuthGateProps = {
  children: ReactNode;
};

type AuthState = "loading" | "authed" | "guest";

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("loading");

  const nextPath = useMemo(() => {
    if (!pathname || !pathname.startsWith("/")) {
      return "/dashboard";
    }
    return pathname;
  }, [pathname]);

  useEffect(() => {
    if (!appwriteEnabled) {
      setAuthState("authed");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setAuthState("authed");
      return;
    }

    const account = new Account(appwrite.client);
    account
      .get()
      .then(() => setAuthState("authed"))
      .catch(() => {
        setAuthState("guest");
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      });
  }, [router, nextPath]);

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
