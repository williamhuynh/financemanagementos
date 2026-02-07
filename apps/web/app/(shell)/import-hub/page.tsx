import { Card, SectionHead } from "@financelab/ui";
import ImportHubClient from "./ImportHubClient";

export default function ImportHubPage() {
  return (
    <>
      <SectionHead
        eyebrow="Import Hub"
        title="Upload Statement"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Import Hub" }
        ]}
      />
      <div className="import-grid">
        <Card title="Import Flow">
          <ImportHubClient />
        </Card>
        <Card title="Import Steps">
          <ol className="steps">
            <li>Upload and map columns</li>
            <li>Preview normalized rows</li>
            <li>Review duplicates</li>
            <li>Finalize and tag</li>
          </ol>
        </Card>
      </div>
    </>
  );
}
