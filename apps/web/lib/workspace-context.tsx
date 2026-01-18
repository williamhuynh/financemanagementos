'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { Account } from 'appwrite';
import { useAuth } from './auth-context';
import { getAppwriteClient } from './appwriteClient';

export interface Workspace {
  id: string;
  name: string;
  currency: string;
  owner_id: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
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

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
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
  }, [user]);

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
      console.log(`[CLIENT] Creating workspace: name="${name}", currency="${currency}"`);

      // Cookies are sent automatically by the browser - no manual headers needed!
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Ensure cookies are included
        body: JSON.stringify({ name, currency })
      });

      console.log(`[CLIENT] Response status: ${response.status} ${response.statusText}`);

      if (response.status === 401) {
        console.error('[CLIENT] Unauthorized (401) - session may be invalid or expired');
        throw new Error('Your session has expired. Please log out and log back in to continue.');
      }

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[CLIENT] Error response:', errorData);
        throw new Error(`Failed to create workspace: ${response.status} ${errorData.detail || response.statusText}`);
      }

      const data = await response.json();
      const newWorkspace = data.workspace;
      console.log('[CLIENT] Workspace created successfully:', newWorkspace.id);

      setWorkspaces((prev) => [...prev, newWorkspace]);
      setCurrentWorkspaceId(newWorkspace.id);
      localStorage.setItem('currentWorkspaceId', newWorkspace.id);

      return newWorkspace;
    } catch (error) {
      console.error('[CLIENT] Error creating workspace:', error);
      throw error; // Re-throw to let the UI handle it
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
