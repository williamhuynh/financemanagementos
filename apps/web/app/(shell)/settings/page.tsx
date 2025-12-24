import Link from "next/link";
import { Card, SectionHead } from "@financelab/ui";
import SessionActions from "./sessionActions";

export default function SettingsPage() {
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
      <Card title="Members">
        <div className="list-row">
          <div>
            <div className="row-title">William Huynh</div>
            <div className="row-sub">Owner</div>
          </div>
          <button className="ghost-btn" type="button">
            Manage
          </button>
        </div>
        <div className="list-row">
          <div>
            <div className="row-title">Peggy Wong</div>
            <div className="row-sub">Editor</div>
          </div>
          <button className="ghost-btn" type="button">
            Manage
          </button>
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
      <SessionActions />
    </>
  );
}
