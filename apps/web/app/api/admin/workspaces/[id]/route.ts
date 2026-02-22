import { NextResponse } from "next/server";
import { getApiContext, createSessionClient } from "../../../../../lib/api-auth";
import { isSuperadmin } from "../../../../../lib/admin-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../../lib/rate-limit";
import { COLLECTIONS } from "../../../../../lib/collection-names";
import { PLAN_IDS } from "../../../../../lib/plans";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const { id: workspaceId } = await context.params;
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

    const body = await request.json();
    const update: Record<string, string> = {};

    // Validate plan
    if (body.plan !== undefined) {
      if (body.plan !== PLAN_IDS.FREE && body.plan !== PLAN_IDS.PRO) {
        return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
      }
      update.plan = body.plan;
    }

    // Validate feature_overrides
    if (body.feature_overrides !== undefined) {
      try {
        const parsed = JSON.parse(body.feature_overrides);
        if (!Array.isArray(parsed)) {
          return NextResponse.json(
            { error: "feature_overrides must be a JSON array" },
            { status: 400 }
          );
        }
        update.feature_overrides = body.feature_overrides;
      } catch {
        return NextResponse.json(
          { error: "feature_overrides must be valid JSON" },
          { status: 400 }
        );
      }
    }

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await ctx.databases.updateDocument(
      ctx.config.databaseId,
      COLLECTIONS.WORKSPACES,
      workspaceId,
      update
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Admin workspace PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
