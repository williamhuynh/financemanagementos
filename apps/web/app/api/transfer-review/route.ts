import { NextResponse } from "next/server";
import { getApiContext } from "../../../lib/api-auth";
import { getTransferReviewData } from "../../../lib/data";

export async function GET() {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const data = await getTransferReviewData(ctx.workspaceId);

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Transfer review GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
