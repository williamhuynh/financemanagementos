import { Suspense } from "react";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getNavItems, getSidebarMonthlyCloseStatus } from "../../lib/data";
import AuthGate from "./authGate";
import TopbarWithUser from "./TopbarWithUser";
import AppShell from "./AppShell";
import { AuthProvider } from "../../lib/auth-context";
import { WorkspaceProvider } from "../../lib/workspace-context";
import { NumberVisibilityProvider } from "../../lib/number-visibility-context";
import { getApiContext } from "../../lib/api-auth";
import EmailVerificationBanner from "./EmailVerificationBanner";

// Ensure the shell layout is always dynamically rendered (never cached).
// getApiContext() reads cookies which should auto-opt into dynamic rendering,
// but revalidate = 0 is an explicit safety net against stale data.
export const revalidate = 0;

type ShellLayoutProps = {
  children: ReactNode;
};

export default async function ShellLayout({ children }: ShellLayoutProps) {
  // Authenticate and get workspace context (cached per render pass via React cache())
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  // Fetch nav items and sidebar status in parallel
  // getNavItems() is a static return so it's instant, but we parallelize
  // getSidebarMonthlyCloseStatus to avoid sequential await chains.
  const [navItems, monthlyCloseStatus] = await Promise.all([
    getNavItems(),
    getSidebarMonthlyCloseStatus(context.workspaceId),
  ]);

  // Email verification is already available from getApiContext() — no extra API call needed
  const emailVerified = context.user.emailVerification ?? true;

  // Pass server-verified user to AuthProvider so it skips the client-side session fetch
  const serverUser = {
    id: context.user.$id,
    email: context.user.email,
    name: context.user.name,
  };

  return (
    <AuthProvider serverUser={serverUser}>
      <WorkspaceProvider>
        <NumberVisibilityProvider>
          <AppShell navItems={navItems} monthlyCloseData={monthlyCloseStatus}>
            <EmailVerificationBanner emailVerified={emailVerified} />
            <Suspense fallback={<div className="topbar" />}>
              <TopbarWithUser />
            </Suspense>
            <AuthGate>{children}</AuthGate>
          </AppShell>
        </NumberVisibilityProvider>
      </WorkspaceProvider>
    </AuthProvider>
  );
}
