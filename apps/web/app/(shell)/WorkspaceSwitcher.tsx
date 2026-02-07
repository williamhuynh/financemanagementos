"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "../../lib/workspace-context";

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const { workspaces, currentWorkspaceId, loading, switchWorkspace } = useWorkspace();
  const [switching, setSwitching] = useState(false);

  const handleSwitchWorkspace = async (workspaceId: string) => {
    if (workspaceId === currentWorkspaceId || switching) {
      return;
    }

    setSwitching(true);
    try {
      const response = await fetch("/api/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId })
      });

      if (response.ok) {
        switchWorkspace(workspaceId);
        router.refresh();
      } else {
        console.error("Failed to switch workspace");
      }
    } catch (error) {
      console.error("Error switching workspace:", error);
    } finally {
      setSwitching(false);
    }
  };

  if (loading || workspaces.length <= 1) {
    return null;
  }

  return (
    <div className="workspace-switcher">
      <span className="label">Workspace</span>
      <select
        className="workspace-select"
        value={currentWorkspaceId || ""}
        onChange={(e) => handleSwitchWorkspace(e.target.value)}
        disabled={switching}
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
    </div>
  );
}
