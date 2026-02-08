"use client";

import { createContext, useContext, useState, useMemo, ReactNode } from "react";
import { useAuth } from "./auth-context";

type ViewMode = "household" | "me";

interface ViewState {
  mode: ViewMode;
  toggleMode: () => void;
  /** The current user's first name (used to match source_owner / owner fields) */
  userFirstName: string;
  /** Returns true if a given owner value should be visible in the current view */
  isVisibleOwner: (owner: string) => boolean;
}

const ViewContext = createContext<ViewState | undefined>(undefined);

export function ViewProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [mode, setMode] = useState<ViewMode>("household");

  const userFirstName = useMemo(() => {
    if (!user?.name) return "";
    return user.name.trim().split(/\s+/)[0] ?? "";
  }, [user]);

  const toggleMode = () => {
    setMode((prev) => (prev === "household" ? "me" : "household"));
  };

  const isVisibleOwner = (owner: string): boolean => {
    if (mode === "household") return true;
    if (!owner || owner === "Joint") return true;
    return owner.toLowerCase() === userFirstName.toLowerCase();
  };

  return (
    <ViewContext.Provider value={{ mode, toggleMode, userFirstName, isVisibleOwner }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error("useView must be used within a ViewProvider");
  }
  return context;
}
