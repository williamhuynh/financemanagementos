import { NextResponse } from "next/server";
import { getApiContext } from "../../../../lib/api-auth";
import { getSidebarMonthlyCloseStatus } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getApiContext();
  if (!context) {
    return NextResponse.json({ status: null });
  }

  const status = await getSidebarMonthlyCloseStatus(context.workspaceId, context.currency);
  return NextResponse.json({ status });
}
