import { redirect } from "next/navigation";
import AssetsClient from "./AssetsClient";
import { getAssetOverview } from "../../../lib/data";
import { getApiContext } from "../../../lib/api-auth";

export default async function AssetsPage() {
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const overview = await getAssetOverview(context.workspaceId);

  return <AssetsClient overview={overview} />;
}
