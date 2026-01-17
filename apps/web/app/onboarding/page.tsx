import { Suspense } from "react";
import OnboardingClient from "./OnboardingClient";

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="card auth-card">
            <div className="card-title">Loading</div>
            <div className="card-sub">Setting up your account...</div>
          </div>
        </div>
      }
    >
      <OnboardingClient />
    </Suspense>
  );
}
