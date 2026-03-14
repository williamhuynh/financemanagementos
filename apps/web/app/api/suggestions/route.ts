import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { formatSuggestion } from "../../../lib/suggestions";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      [
        Query.equal("workspace_id", workspaceId),
        Query.orderDesc("$createdAt"),
        Query.limit(200),
      ]
    );

    const suggestions = (response.documents as AppwriteDocument[]).map((doc) =>
      formatSuggestion(doc, user.$id)
    );

    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not member")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("Suggestions GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const body = await request.json();
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();

    if (!title || title.length > 200) {
      return NextResponse.json(
        { error: "Title is required and must be 200 characters or less" },
        { status: 400 }
      );
    }
    if (!description || description.length > 2000) {
      return NextResponse.json(
        { error: "Description is required and must be 2000 characters or less" },
        { status: 400 }
      );
    }

    const doc = await databases.createDocument(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      ID.unique(),
      {
        workspace_id: workspaceId,
        user_id: user.$id,
        user_name: user.name || user.email || "Unknown",
        title,
        description,
        status: "new",
        upvoted_by: "[]",
      }
    );

    return NextResponse.json({ suggestion: formatSuggestion(doc as AppwriteDocument, user.$id) }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not member")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
    console.error("Suggestions POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
