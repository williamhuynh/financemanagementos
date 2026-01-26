import { Suspense } from "react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { Sidebar } from "@financelab/ui";
import { getNavItems, getSidebarMonthlyCloseStatus } from "../../lib/data";
import AuthGate from "./authGate";
import TopbarWithUser from "./TopbarWithUser";
import { AuthProvider } from "../../lib/auth-context";
import { WorkspaceProvider } from "../../lib/workspace-context";
import { NumberVisibilityProvider } from "../../lib/number-visibility-context";
import { getApiContext } from "../../lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type ShellLayoutProps = {
  children: ReactNode;
};

export default async function ShellLayout({ children }: ShellLayoutProps) {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const navItems = getNavItems();
  const monthlyCloseStatus = await getSidebarMonthlyCloseStatus(context.workspaceId);

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <NumberVisibilityProvider>
          <div className="app-shell">
            <Sidebar navItems={navItems} monthlyCloseData={monthlyCloseStatus} />
            <main className="main">
              <Suspense fallback={<div className="topbar" />}>
                <TopbarWithUser />
              </Suspense>
              <AuthGate>{children}</AuthGate>
            </main>
          </div>
        </NumberVisibilityProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
