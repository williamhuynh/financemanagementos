"use client";

import { useMemo } from "react";
import { Topbar } from "@tandemly/ui";
import { useAuth } from "../../lib/auth-context";
import { useNumberVisibility } from "../../lib/number-visibility-context";
import { useView } from "../../lib/view-context";
import WorkspaceSwitcher from "./WorkspaceSwitcher";
import { useDrawer } from "./AppShell";

export default function TopbarWithUser() {
  const { user } = useAuth();
  const { isVisible, toggleVisibility } = useNumberVisibility();
  const { mode, toggleMode } = useView();
  const { toggle } = useDrawer();

  const userInitials = useMemo(() => {
    if (!user?.name) return "";
    const parts = user.name.trim().split(/\s+/);
    return (
      (parts[0]?.charAt(0) ?? "") + (parts[1]?.charAt(0) ?? "")
    ).toUpperCase();
  }, [user]);

  return (
    <Topbar
      profileHref="/profile"
      userInitials={userInitials}
      onToggleNumberVisibility={toggleVisibility}
      numbersVisible={isVisible}
      viewMode={mode}
      onToggleViewMode={toggleMode}
      workspaceSwitcher={<WorkspaceSwitcher />}
      onMenuToggle={toggle}
    />
  );
}
