import AssetsClient from "./AssetsClient";
import { getAssetOverview } from "../../../lib/data";

export default async function AssetsPage() {
  const overview = await getAssetOverview();

  return <AssetsClient overview={overview} />;
}
