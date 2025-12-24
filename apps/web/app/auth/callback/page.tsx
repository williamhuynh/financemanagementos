import { Suspense } from "react";
import CallbackClient from "./CallbackClient";

export default function MagicLinkCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="card auth-card">
            <div className="card-title">Loading</div>
            <div className="card-sub">Completing sign-in...</div>
          </div>
        </div>
      }
    >
      <CallbackClient />
    </Suspense>
  );
}
