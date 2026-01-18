"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Account } from "appwrite";
import { Card } from "@financelab/ui";
import { getAppwriteClient } from "../../../lib/appwriteClient";

type SignOutState = "idle" | "working" | "error";

export default function SessionActions() {
  const router = useRouter();
  const [signOutState, setSignOutState] = useState<SignOutState>("idle");

  const handleSignOut = async () => {
    const appwrite = getAppwriteClient();
    if (!appwrite) {
      setSignOutState("error");
      return;
    }

    setSignOutState("working");
    try {
      const account = new Account(appwrite.client);
      await account.deleteSession("current");
      // Clear the stored session secret
      localStorage.removeItem("appwrite_session_secret");
      router.replace("/login");
    } catch (error) {
      setSignOutState("error");
    }
  };

  return (
    <Card title="Session">
      <div className="list-row">
        <div>
          <div className="row-title">Signed-in session</div>
          <div className="row-sub">Log out of this device if needed.</div>
        </div>
        <button
          className="ghost-btn danger-btn"
          type="button"
          onClick={handleSignOut}
          disabled={signOutState === "working"}
        >
          {signOutState === "working" ? "Signing out..." : "Sign out"}
        </button>
      </div>
      {signOutState === "error" ? (
        <div className="row-sub">We could not sign you out. Try again.</div>
      ) : null}
    </Card>
  );
}
