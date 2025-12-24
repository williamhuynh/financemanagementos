import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="card auth-card">
            <div className="card-title">Loading</div>
            <div className="card-sub">Preparing sign-in...</div>
          </div>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
