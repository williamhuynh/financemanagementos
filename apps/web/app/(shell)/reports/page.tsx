import Link from "next/link";
import { Card, SectionHead } from "@financelab/ui";
import { getReportStats } from "../../../lib/data";

export default async function ReportsPage() {
  const reportStats = await getReportStats();

  return (
    <>
      <SectionHead
        eyebrow="Reports"
        title="Monthly Close"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Reports" }
        ]}
        actions={
          <>
            <button className="pill" type="button">
              Export CSV
            </button>
            <button className="pill" type="button">
              Export PDF
            </button>
            <Link className="pill" href="/reports/expenses">
              Expense detail
            </Link>
          </>
        }
      />
      <div className="grid cards">
        {reportStats.map((stat) => (
          <Card key={stat.title} title={stat.title} value={stat.value} sub={stat.sub} />
        ))}
      </div>
    </>
  );
}
