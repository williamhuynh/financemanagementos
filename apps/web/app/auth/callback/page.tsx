"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Account } from "appwrite";
import { appwriteEnabled, getAppwriteClient } from "../../../lib/appwriteClient";

type CallbackState = "loading" | "success" | "error";

export default function MagicLinkCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<CallbackState>("loading");
  const [message, setMessage] = useState<string>("Completing sign-in...");

  const nextPath = useMemo(() => {
    const candidate = searchParams.get("next");
    if (candidate && candidate.startsWith("/")) {
      return candidate;
    }
    return "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!appwriteEnabled) {
      setState("error");
      setMessage("Appwrite auth is not configured yet.");
      return;
    }

    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setState("error");
      setMessage("Appwrite auth is not configured yet.");
      return;
    }

    const userId = searchParams.get("userId");
    const secret = searchParams.get("secret");

    if (!userId || !secret) {
      setState("error");
      setMessage("The magic link is missing details. Please request a new link.");
      return;
    }

    const account = new Account(appwrite.client);
    account
      .updateMagicURLSession(userId, secret)
      .then(() => {
        setState("success");
        setMessage("Signed in. Redirecting...");
        router.replace(nextPath);
      })
      .catch(() => {
        setState("error");
        setMessage("We could not validate the magic link. Please request a new one.");
      });
  }, [router, searchParams, nextPath]);

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">FinanceLab</div>
        <h1 className="auth-title">Signing you in</h1>
        <p className={state === "error" ? "auth-error" : "auth-sub"}>{message}</p>
        {state === "error" ? (
          <button className="primary-btn" type="button" onClick={() => router.replace("/login")}>
            Back to sign in
          </button>
        ) : null}
      </div>
    </div>
  );
}
