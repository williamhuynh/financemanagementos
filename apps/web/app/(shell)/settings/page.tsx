import { Card, SectionHead } from "@financelab/ui";

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
        actions={
          <>
            <button className="pill" type="button">
              Invite member
            </button>
            <button className="pill" type="button">
              Billing
            </button>
          </>
        }
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
    </>
  );
}
