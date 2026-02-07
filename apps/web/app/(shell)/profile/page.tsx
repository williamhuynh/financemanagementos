"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionHead } from "@financelab/ui";
import { useAuth } from "../../../lib/auth-context";

type SignOutState = "idle" | "working" | "error";

function parseUserName(name: string | undefined | null) {
  if (!name || !name.trim()) {
    return { firstName: "", lastName: "" };
  }
  const parts = name.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [signOutState, setSignOutState] = useState<SignOutState>("idle");

  const { firstName, lastName } = parseUserName(user?.name);
  const initials =
    (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || "?";

  const handleSignOut = async () => {
    setSignOutState("working");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
    } catch {
      setSignOutState("error");
    }
  };

  return (
    <>
      <SectionHead
        eyebrow="Account"
        title="Profile"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Profile" },
        ]}
      />
      <div className="profile-card">
        <div className="profile-avatar-large" aria-hidden="true">
          {initials}
        </div>
        <div className="profile-info">
          <div className="profile-field">
            <span className="profile-label">First name</span>
            <span className="profile-value">{firstName || "\u2014"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Last name</span>
            <span className="profile-value">{lastName || "\u2014"}</span>
          </div>
          <div className="profile-field">
            <span className="profile-label">Email</span>
            <span className="profile-value">{user?.email || "\u2014"}</span>
          </div>
        </div>
        <div className="profile-actions">
          <button
            className="ghost-btn danger-btn"
            type="button"
            onClick={handleSignOut}
            disabled={signOutState === "working"}
          >
            {signOutState === "working" ? "Signing out\u2026" : "Sign out"}
          </button>
          {signOutState === "error" && (
            <div className="row-sub">
              We could not sign you out. Try again.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
