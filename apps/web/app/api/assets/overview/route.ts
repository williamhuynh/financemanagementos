import { NextResponse } from "next/server";
import { getAssetOverview } from "../../../../lib/data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const overview = await getAssetOverview();
  return NextResponse.json(overview, {
    headers: {
      "Cache-Control": "no-store, max-age=0"
    }
  });
}
