import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext, createSessionClient } from "../../../../lib/api-auth";
import { isSuperadmin } from "../../../../lib/admin-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { COLLECTIONS } from "../../../../lib/collection-names";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check superadmin via Appwrite user labels
    const session = await createSessionClient();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = await session.account.get();
    if (!isSuperadmin(user.labels)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { databases, config } = ctx;

    // Get search param
    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    // Fetch all workspaces
    const queries = [Query.orderDesc("$createdAt"), Query.limit(100)];
    if (search) {
      queries.push(Query.search("name", search));
    }

    const workspaces = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.WORKSPACES,
      queries
    );

    // For each workspace, get usage counts
    const results = await Promise.all(
      workspaces.documents.map(async (ws: AppwriteDocument) => {
        const [members, assets] = await Promise.all([
          databases.listDocuments(config.databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
            Query.equal("workspace_id", ws.$id),
            Query.limit(1),
          ]),
          databases.listDocuments(config.databaseId, COLLECTIONS.ASSETS, [
            Query.equal("workspace_id", ws.$id),
            Query.limit(1),
          ]),
        ]);

        return {
          id: ws.$id,
          name: ws.name,
          owner_id: ws.owner_id,
          plan: ws.plan || "free",
          feature_overrides: ws.feature_overrides || "[]",
          memberCount: members.total,
          assetCount: assets.total,
        };
      })
    );

    return NextResponse.json({ workspaces: results });
  } catch (error) {
    console.error("Admin workspaces GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
