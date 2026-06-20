import { redirect } from "next/navigation";
import AssetsClient from "./AssetsClient";
import { getAssetOverview, getWorkspaceOwnerOptions } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";

export default async function AssetsPage() {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const homeCurrency = context.currency;

  const [overview, ownerOptions] = await Promise.all([
    getAssetOverview(context.workspaceId, homeCurrency),
    getWorkspaceOwnerOptions(context.workspaceId)
  ]);

  return <AssetsClient overview={overview} ownerOptions={ownerOptions} homeCurrency={homeCurrency} />;
}
