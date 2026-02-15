import { redirect } from "next/navigation";
import AssetsClient from "./AssetsClient";
import { getAssetOverview, getWorkspaceOwnerOptions } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";
import { getWorkspaceById } from "../../../lib/workspace-service";

export default async function AssetsPage() {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const workspace = await getWorkspaceById(context.workspaceId);
  const homeCurrency = workspace?.currency ?? "AUD";

  const [overview, ownerOptions] = await Promise.all([
    getAssetOverview(context.workspaceId, homeCurrency),
    getWorkspaceOwnerOptions(context.workspaceId)
  ]);

  return <AssetsClient overview={overview} ownerOptions={ownerOptions} homeCurrency={homeCurrency} />;
}
