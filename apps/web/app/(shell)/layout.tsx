import type { ReactNode } from "react";
import { Sidebar, Topbar } from "@financelab/ui";
import { getNavItems } from "../../lib/data";

type ShellLayoutProps = {
  children: ReactNode;
};

export default async function ShellLayout({ children }: ShellLayoutProps) {
  const navItems = await getNavItems();

  return (
    <div className="app-shell">
      <Sidebar navItems={navItems} />
      <main className="main">
        <Topbar />
        {children}
      </main>
    </div>
  );
}
