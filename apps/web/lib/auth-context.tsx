'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Account, type Models } from 'appwrite';
import { getAppwriteClient } from './appwriteClient';

type User = Models.User<Models.Preferences> | null;

interface AuthState {
  user: User;
  loading: boolean;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const appwrite = getAppwriteClient();
      if (!appwrite) {
        setUser(null);
        setLoading(false);
        return;
      }

      const account = new Account(appwrite.client);
      const userData = await account.get();
      setUser(userData);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

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
