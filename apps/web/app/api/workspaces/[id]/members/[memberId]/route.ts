import { NextResponse } from "next/server";
import { Client, Databases } from "node-appwrite";
import { getApiContext } from "../../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../../../../lib/collection-names";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

/**
 * DELETE /api/workspaces/[id]/members/[memberId]
 * Remove a member from a workspace
 * Requires 'admin' permission
 * Owners cannot be removed
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: workspaceId, memberId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has admin permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.user.$id, "admin");

    // Use API key client for database operations
    const client = new Client();
    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);

    // Get the membership to verify it belongs to this workspace
    let membership;
    try {
      membership = await databases.getDocument(
        databaseId,
        COLLECTIONS.WORKSPACE_MEMBERS,
        memberId
      );
    } catch {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (membership.workspace_id !== workspaceId) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    // Prevent removing owners
    if (membership.role === "owner") {
      return NextResponse.json(
        { error: "Cannot remove workspace owner" },
        { status: 403 }
      );
    }

    // Prevent self-removal (use leave endpoint instead)
    if (membership.user_id === ctx.user.$id) {
      return NextResponse.json(
        { error: "Cannot remove yourself. Use the leave workspace option instead." },
        { status: 400 }
      );
    }

    // Delete the membership
    await databases.deleteDocument(
      databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      memberId
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message?.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message?.includes("permission")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to remove member:", error);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
