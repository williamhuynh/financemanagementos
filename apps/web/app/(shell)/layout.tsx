import { Suspense } from "react";
import type { ReactNode } from "react";
import { Sidebar } from "@financelab/ui";
import { getNavItems } from "../../lib/data";
import AuthGate from "./authGate";
import TopbarWithUser from "./TopbarWithUser";

type ShellLayoutProps = {
  children: ReactNode;
};

export default async function ShellLayout({ children }: ShellLayoutProps) {
  const navItems = await getNavItems();

  return (
    <div className="app-shell">
      <Sidebar navItems={navItems} />
      <main className="main">
        <Suspense fallback={<div className="topbar" />}>
          <TopbarWithUser />
        </Suspense>
        <AuthGate>{children}</AuthGate>
      </main>
    </div>
  );
}
