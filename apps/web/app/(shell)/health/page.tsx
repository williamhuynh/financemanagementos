import { Card, SectionHead } from "@financelab/ui";
import { getHealthChecks } from "../../../lib/health";

const statusLabels = {
  ok: { label: "OK", className: "" },
  warning: { label: "Warning", className: "warn" },
  error: { label: "Error", className: "error" }
};

export default async function HealthPage() {
  const checks = await getHealthChecks();

  return (
    <>
      <SectionHead
        eyebrow="System"
        title="Health Check"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Health" }
        ]}
        actions={
          <>
            <button className="pill" type="button">
              Refresh
            </button>
            <button className="pill" type="button">
              View logs
            </button>
          </>
        }
      />
      <Card title="Services">
        <div className="list">
          {checks.map((check) => {
            const meta = statusLabels[check.status];
            return (
              <div key={check.id} className="list-row">
                <div>
                  <div className="row-title">{check.name}</div>
                  <div className="row-sub">{check.detail}</div>
                </div>
                <span className={`chip ${meta.className}`}>{meta.label}</span>
              </div>
            );
          })}
        </div>
        <div className="row-sub">More checks can be added here as the backend grows.</div>
      </Card>
    </>
  );
}
