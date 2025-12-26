import AssetsClient from "./AssetsClient";
import { getAssetOverview } from "../../../lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AssetsPage() {
  const overview = await getAssetOverview();

  return <AssetsClient overview={overview} />;
}
