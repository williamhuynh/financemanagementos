import { NextResponse } from "next/server";
import { getApiContext } from "../../../lib/api-auth";
import { getTransferReviewData } from "../../../lib/data";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
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
