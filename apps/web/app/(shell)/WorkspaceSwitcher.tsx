"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Workspace = {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  role: string;
};

export default function WorkspaceSwitcher() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    async function fetchWorkspaces() {
      try {
        const response = await fetch("/api/workspaces");
        if (response.ok) {
          const data = await response.json();
          setWorkspaces(data.workspaces || []);
          setCurrentWorkspaceId(data.currentWorkspaceId || null);
        }
      } catch (error) {
        console.error("Failed to fetch workspaces:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchWorkspaces();
  }, []);

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
        setCurrentWorkspaceId(workspaceId);
        // Refresh the page to reload all data with new workspace
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

  if (loading || workspaces.length === 0) {
    return null;
  }

  // Don't show switcher if only one workspace
  if (workspaces.length === 1) {
    return null;
  }

  const currentWorkspace = workspaces.find(w => w.id === currentWorkspaceId);

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
