"use client";

import { useMemo } from "react";
import { Topbar } from "@financelab/ui";
import { useAuth } from "../../lib/auth-context";
import { useNumberVisibility } from "../../lib/number-visibility-context";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { useDrawer } from "./AppShell";

export default function TopbarWithUser() {
  const { user } = useAuth();
  const { isVisible, toggleVisibility } = useNumberVisibility();
  const { toggle } = useDrawer();

  const userLabel = useMemo(() => {
    if (!user) {
      return "Signed in";
    }
    const label = user.name?.trim() || user.email?.trim();
    return label ? `Signed in as ${label}` : "Signed in";
  }, [user]);

  return (
    <Topbar
      userLabel={userLabel}
      onToggleNumberVisibility={toggleVisibility}
      numbersVisible={isVisible}
      workspaceSwitcher={<WorkspaceSwitcher />}
      onMenuToggle={toggle}
    />
  );
}
