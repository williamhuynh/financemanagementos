"use client";

import { useState, useCallback, createContext, useContext, useEffect } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar, Drawer } from "@financelab/ui";

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

type AppShellProps = {
  navItems: NavItem[];
  monthlyCloseData?: {
    unresolvedCount: number;
    monthKey: string;
  } | null;
  children: ReactNode;
};

export default function AppShell({ navItems, monthlyCloseData, children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setDrawerOpen(false);
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
