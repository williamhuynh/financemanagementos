import { redirect } from "next/navigation";
import { Card, SectionHead } from "@financelab/ui";
import ImportHubClient from "./ImportHubClient";
import { getWorkspaceOwnerOptions } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";

export default async function ImportHubPage() {
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const ownerOptions = await getWorkspaceOwnerOptions(context.workspaceId);

  return (
    <>
      <SectionHead
        title="Upload Statement"
      />
      <div className="import-grid">
        <Card title="Import Flow">
          <ImportHubClient ownerOptions={ownerOptions} />
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
