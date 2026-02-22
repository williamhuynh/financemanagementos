import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { getPlanConfig } from "../../../lib/plans";
import { COLLECTIONS } from "../../../lib/collection-names";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await requireWorkspacePermission(ctx.workspaceId, ctx.user.$id, "read");

    const planConfig = getPlanConfig(ctx.plan);

    // Count current usage in parallel
    const [assets, members, accountCount] = await Promise.all([
      ctx.databases.listDocuments(ctx.config.databaseId, COLLECTIONS.ASSETS, [
        Query.equal("workspace_id", ctx.workspaceId),
        Query.limit(1),
      ]),
      ctx.databases.listDocuments(
        ctx.config.databaseId,
        COLLECTIONS.WORKSPACE_MEMBERS,
        [Query.equal("workspace_id", ctx.workspaceId), Query.limit(1)]
      ),
      // Count unique account names from transactions
      (async () => {
        const names = new Set<string>();
        let offset = 0;
        while (true) {
          const resp = await ctx.databases.listDocuments(
            ctx.config.databaseId,
            COLLECTIONS.TRANSACTIONS,
            [
              Query.equal("workspace_id", ctx.workspaceId),
              Query.limit(100),
              Query.offset(offset),
            ]
          );
          for (const doc of resp.documents) {
            const name = String(doc.account_name ?? "").trim();
            if (name) names.add(name);
          }
          offset += resp.documents.length;
          if (resp.documents.length === 0 || offset >= resp.total) break;
        }
        return names.size;
      })(),
    ]);

    return NextResponse.json({
      plan: ctx.plan,
      planLabel: planConfig.label,
      limits: {
        maxAccounts: planConfig.limits.maxAccounts,
        maxAssets: planConfig.limits.maxAssets,
        maxMembers: planConfig.limits.maxMembers,
      },
      usage: {
        accounts: accountCount,
        assets: assets.total,
        members: members.total,
      },
    });
  } catch (error) {
    console.error("Billing GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
