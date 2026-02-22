import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, SectionHead } from "@tandemly/ui";
import { getApiContext } from "../../../lib/api-auth";
import MembersSection from "./MembersSection";

export default async function SettingsPage() {
  const ctx = await getApiContext();

  if (!ctx) {
    redirect("/login");
  }

  return (
    <>
      <SectionHead
        title="Workspace"
      />
      <MembersSection
        workspaceId={ctx.workspaceId}
        currentUserId={ctx.user.$id}
        userRole={ctx.role}
      />
      <Card title="Plan & Billing">
        <div className="list-row">
          <div>
            <div className="row-title">Subscription</div>
            <div className="row-sub">View your plan, usage, and billing</div>
          </div>
          <Link className="ghost-btn" href="/settings/billing">
            Manage
          </Link>
        </div>
      </Card>
      <Card title="System">
        <div className="list-row">
          <div>
            <div className="row-title">Health</div>
            <div className="row-sub">Connectivity and service checks</div>
          </div>
          <Link className="ghost-btn" href="/health">
            View
          </Link>
        </div>
      </Card>
    </>
  );
}
