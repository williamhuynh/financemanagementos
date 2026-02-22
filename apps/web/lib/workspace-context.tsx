'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useAuth } from './auth-context';

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  plan: string;
  feature_overrides: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentWorkspaceId: string | null;
  loading: boolean;
  needsOnboarding: boolean;
  refreshWorkspaces: () => Promise<void>;
  switchWorkspace: (workspaceId: string) => void;
  createWorkspace: (name: string, currency?: string) => Promise<Workspace | null>;
}

const WorkspaceContext = createContext<WorkspaceState | undefined>(undefined);

// No helper function needed - browser automatically sends cookies!

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Use primitive user ID as dependency so the callback reference stays stable
  // even if the user object reference changes across server re-renders.
  const userId = user?.id ?? null;

  const fetchWorkspaces = useCallback(async () => {
    if (!userId) {
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
      setLoading(false);
      return;
    }

    try {
      // Cookies are sent automatically by the browser - no manual headers needed!
      const response = await fetch('/api/workspaces', {
        credentials: 'include' // Ensure cookies are included
      });

      if (!response.ok) {
        throw new Error('Failed to fetch workspaces');
      }

      const data = await response.json();
      setWorkspaces(data.workspaces || []);

      // Use stored preference or default to first workspace
      const storedWorkspaceId = localStorage.getItem('currentWorkspaceId');
      const validWorkspace = data.workspaces?.find(
        (w: Workspace) => w.id === storedWorkspaceId
      );

      if (validWorkspace) {
        setCurrentWorkspaceId(validWorkspace.id);
      } else if (data.currentWorkspaceId) {
        setCurrentWorkspaceId(data.currentWorkspaceId);
        localStorage.setItem('currentWorkspaceId', data.currentWorkspaceId);
      } else {
        setCurrentWorkspaceId(null);
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
      setWorkspaces([]);
      setCurrentWorkspaceId(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    fetchWorkspaces();
  }, [authLoading, fetchWorkspaces]);

  const switchWorkspace = useCallback((workspaceId: string) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (workspace) {
      setCurrentWorkspaceId(workspaceId);
      localStorage.setItem('currentWorkspaceId', workspaceId);
    }
  }, [workspaces]);

  const createWorkspace = useCallback(async (
    name: string,
    currency: string = 'AUD'
  ): Promise<Workspace | null> => {
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ name, currency })
      });

      if (response.status === 401) {
        throw new Error('Your session has expired. Please log out and log back in to continue.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Failed to create workspace: ${response.status} ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      const newWorkspace = data.workspace;

      setWorkspaces((prev) => [...prev, newWorkspace]);
      setCurrentWorkspaceId(newWorkspace.id);
      localStorage.setItem('currentWorkspaceId', newWorkspace.id);

      return newWorkspace;
    } catch (error) {
      throw error;
    }
  }, []);

  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId) || null;
  const needsOnboarding = !loading && !authLoading && user !== null && workspaces.length === 0;

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        currentWorkspaceId,
        loading: loading || authLoading,
        needsOnboarding,
        refreshWorkspaces: fetchWorkspaces,
        switchWorkspace,
        createWorkspace
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
