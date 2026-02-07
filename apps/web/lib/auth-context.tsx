'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

/**
 * User type based on server session data
 * No longer uses Appwrite Models - we get this from our session API
 */
type User = {
  id: string;
  email: string;
  name: string;
} | null;

interface AuthState {
  user: User;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
  /** Pre-verified user from the server layout — skips the client-side /api/auth/session fetch */
  serverUser?: User;
}

export function AuthProvider({ children, serverUser }: AuthProviderProps) {
  // If serverUser is provided, initialise as already authenticated (no loading state)
  const [user, setUser] = useState<User>(serverUser ?? null);
  const [loading, setLoading] = useState(!serverUser);

  /**
   * Check authentication by calling our server session API
   * This reads from iron-session (server-side) instead of Appwrite client SDK
   */
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Skip initial fetch when server already provided the user
    if (serverUser) return;
    checkAuth();
  }, [serverUser, checkAuth]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshAuth: checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
