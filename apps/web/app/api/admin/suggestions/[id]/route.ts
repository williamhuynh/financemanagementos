import { NextResponse } from "next/server";
import { getApiContext, createSessionClient } from "../../../../../lib/api-auth";
import { isSuperadmin } from "../../../../../lib/admin-guard";
import { COLLECTIONS } from "../../../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../../lib/rate-limit";
import { formatSuggestionAdmin } from "../../../../../lib/suggestions";

type AppwriteDocument = { $id: string; [key: string]: unknown };
type RouteContext = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["new", "approved", "in_progress", "done"] as const;
type SuggestionStatus = (typeof VALID_STATUSES)[number];

function isValidStatus(s: string): s is SuggestionStatus {
  return VALID_STATUSES.includes(s as SuggestionStatus);
}

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const session = await createSessionClient();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await session.account.get();
    if (!isSuperadmin(user.labels)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { databases, config } = ctx;

    const body = await request.json();
    const update: Record<string, string> = {};

    if (body.status !== undefined) {
      const status = String(body.status);
      if (!isValidStatus(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` },
          { status: 400 }
        );
      }
      update.status = status;
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const updated = await databases.updateDocument(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      id,
      update
    ) as AppwriteDocument;

    return NextResponse.json({ suggestion: formatSuggestionAdmin(updated) });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Document with the requested ID could not be found")
    ) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("Admin suggestion PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
