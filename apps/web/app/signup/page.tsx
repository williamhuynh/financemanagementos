import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="card auth-card">
            <div className="card-title">Loading</div>
            <div className="card-sub">Preparing sign-up...</div>
          </div>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
