import { NextRequest, NextResponse } from "next/server";
import { getApiContext } from "../../../lib/api-auth";
import { getTransferReviewData } from "../../../lib/data";

export async function GET(request: NextRequest) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") ?? "25")));

    const data = await getTransferReviewData(ctx.workspaceId);

    const allItems = [
      ...data.paired.map((item) => ({ ...item, _type: "paired" as const })),
      ...data.suggestions.map((item) => ({ ...item, _type: "suggestion" as const })),
      ...data.unmatched.map((item) => ({ ...item, _type: "unmatched" as const }))
    ];

    const total = allItems.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    const pageItems = allItems.slice(offset, offset + limit);

    const paired = pageItems
      .filter((item) => item._type === "paired")
      .map(({ _type, ...rest }) => rest);
    const suggestions = pageItems
      .filter((item) => item._type === "suggestion")
      .map(({ _type, ...rest }) => rest);
    const unmatched = pageItems
      .filter((item) => item._type === "unmatched")
      .map(({ _type, ...rest }) => rest);

    return NextResponse.json({
      paired,
      suggestions,
      unmatched,
      page: safePage,
      totalPages,
      totalItems: total,
      counts: {
        paired: data.paired.length,
        suggestions: data.suggestions.length,
        unmatched: data.unmatched.length
      }
    });
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
