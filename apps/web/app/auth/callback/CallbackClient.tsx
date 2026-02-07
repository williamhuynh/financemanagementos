"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type CallbackState = "loading" | "success" | "error";

export default function CallbackClient() {
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
    setState("error");
    setMessage(
      "Magic link login is no longer supported. Please sign in with your email and password."
    );
  }, []);

  return (
    <div className="auth-page">
      <div className="card auth-card">
        <div className="eyebrow">Tandemly</div>
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
