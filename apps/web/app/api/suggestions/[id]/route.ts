import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";

type AppwriteDocument = { $id: string; [key: string]: unknown };
type RouteContext = { params: Promise<{ id: string }> };

function formatSuggestion(doc: AppwriteDocument, currentUserId?: string) {
  const upvotedBy: string[] = JSON.parse(String(doc.upvoted_by || "[]"));
  return {
    id: doc.$id,
    workspace_id: doc.workspace_id,
    user_id: doc.user_id,
    user_name: doc.user_name,
    title: doc.title,
    description: doc.description,
    status: doc.status,
    upvote_count: upvotedBy.length,
    has_upvoted: currentUserId ? upvotedBy.includes(currentUserId) : false,
    created_at: doc.$createdAt,
    updated_at: doc.$updatedAt,
  };
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

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

    const existing = await databases.getDocument(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      id
    ) as AppwriteDocument;

    // Ensure suggestion belongs to this workspace
    if (existing.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const update: Record<string, string> = {};

    // Edit title/description — only the author can do this
    if (body.title !== undefined || body.description !== undefined) {
      if (existing.user_id !== user.$id) {
        return NextResponse.json({ error: "Only the author can edit this suggestion" }, { status: 403 });
      }
      if (body.title !== undefined) {
        const title = String(body.title).trim();
        if (!title || title.length > 200) {
          return NextResponse.json({ error: "Title must be 1-200 characters" }, { status: 400 });
        }
        update.title = title;
      }
      if (body.description !== undefined) {
        const description = String(body.description).trim();
        if (!description || description.length > 2000) {
          return NextResponse.json({ error: "Description must be 1-2000 characters" }, { status: 400 });
        }
        update.description = description;
      }
    }

    // Upvote toggle — any workspace member
    if (body.upvote !== undefined) {
      const upvotedBy: string[] = JSON.parse(String(existing.upvoted_by || "[]"));
      const alreadyUpvoted = upvotedBy.includes(user.$id);

      if (body.upvote && !alreadyUpvoted) {
        upvotedBy.push(user.$id);
      } else if (!body.upvote && alreadyUpvoted) {
        const idx = upvotedBy.indexOf(user.$id);
        upvotedBy.splice(idx, 1);
      }
      update.upvoted_by = JSON.stringify(upvotedBy);
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

    return NextResponse.json({ suggestion: formatSuggestion(updated, user.$id) });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Document with the requested ID could not be found")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    console.error("Suggestions PATCH error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "read");

    const existing = await databases.getDocument(
      config.databaseId,
      COLLECTIONS.SUGGESTIONS,
      id
    ) as AppwriteDocument;

    if (existing.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Only the author can delete their suggestion
    if (existing.user_id !== user.$id) {
      return NextResponse.json({ error: "Only the author can delete this suggestion" }, { status: 403 });
    }

    await databases.deleteDocument(config.databaseId, COLLECTIONS.SUGGESTIONS, id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Document with the requested ID could not be found")) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    console.error("Suggestions DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
