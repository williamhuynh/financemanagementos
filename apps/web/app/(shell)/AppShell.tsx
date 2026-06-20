"use client";

import { useState, useCallback, createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, Drawer } from "@tandemly/ui";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon?: string;
};

type DrawerContextValue = {
  toggle: () => void;
};

const DrawerContext = createContext<DrawerContextValue>({ toggle: () => {} });

export function useDrawer() {
  return useContext(DrawerContext);
}

type MonthlyCloseData = {
  unresolvedCount: number;
  monthKey: string;
} | null;

type AppShellProps = {
  navItems: NavItem[];
  children: ReactNode;
};

export default function AppShell({ navItems, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [monthlyCloseData, setMonthlyCloseData] = useState<MonthlyCloseData>(null);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workspace/sidebar-status")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMonthlyCloseData(data.status ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const toggle = useCallback(() => {
    setDrawerOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  return (
    <DrawerContext.Provider value={{ toggle }}>
      <Drawer open={drawerOpen} onClose={close}>
        <Sidebar navItems={navItems} monthlyCloseData={monthlyCloseData} />
      </Drawer>
      <div className="app-shell">
        <main className="main">
          {children}
        </main>
      </div>
    </DrawerContext.Provider>
  );
}
