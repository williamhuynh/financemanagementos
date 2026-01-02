"use client";

import { useMemo } from "react";
import { Topbar } from "@financelab/ui";
import { useAuth } from "../../lib/auth-context";

export default function TopbarWithUser() {
  const { user } = useAuth();

  const userLabel = useMemo(() => {
    if (!user) {
      return "Signed in";
    }
    const label = user.name?.trim() || user.email?.trim();
    return label ? `Signed in as ${label}` : "Signed in";
  }, [user]);

  return <Topbar userLabel={userLabel} />;
}
