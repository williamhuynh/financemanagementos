import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext, createSessionClient } from "../../../../lib/api-auth";
import { isSuperadmin } from "../../../../lib/admin-guard";
import { COLLECTIONS } from "../../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";

function formatSuggestion(doc: AppwriteDocument, workspaceName?: string) {
  const upvotedBy: string[] = JSON.parse(String(doc.upvoted_by || "[]"));
  return {
    id: doc.$id,
    workspace_id: doc.workspace_id,
    workspace_name: workspaceName ?? doc.workspace_id,
    user_id: doc.user_id,
    user_name: doc.user_name,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    upvote_count: upvotedBy.length,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
}

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
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

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get("status");

    const queries = [Query.orderDesc("$createdAt"), Query.limit(200)];
    if (statusFilter) {
      queries.push(Query.equal("status", statusFilter));
    }

    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      queries
    );

    // Fetch workspace names in parallel
    const workspaceIds = [
      ...new Set((response.documents as AppwriteDocument[]).map((d) => String(d.workspace_id))),
    ];
    const workspaceNames = new Map<string, string>();
    await Promise.all(
      workspaceIds.map(async (wsId) => {
        try {
          const ws = await databases.getDocument(config.databaseId, COLLECTIONS.WORKSPACES, wsId);
          workspaceNames.set(wsId, String(ws.name ?? wsId));
        } catch {
          workspaceNames.set(wsId, wsId);
        }
      })
    );

    const suggestions = (response.documents as AppwriteDocument[]).map((doc) =>
      formatSuggestion(doc, workspaceNames.get(String(doc.workspace_id)))
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Admin suggestions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
