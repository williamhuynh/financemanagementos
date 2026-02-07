import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, SectionHead } from "@financelab/ui";
import { getApiContext } from "../../../lib/api-auth";
import MembersSection from "./MembersSection";

export default async function SettingsPage() {
  const ctx = await getApiContext();

  if (!ctx) {
    redirect("/signin");
  }

  return (
    <>
      <SectionHead
        eyebrow="Settings"
        title="Workspace"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Settings" }
        ]}
      />
      <MembersSection
        workspaceId={ctx.workspaceId}
        currentUserId={ctx.user.$id}
        userRole={ctx.role}
      />
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
