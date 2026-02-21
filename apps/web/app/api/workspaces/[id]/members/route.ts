import { NextResponse } from "next/server";
import { Query, Client, Databases, Users } from "node-appwrite";
import { getApiContext } from "../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../../lib/rate-limit";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;
const apiKey = process.env.APPWRITE_API_KEY!;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/members
 * List all members of a workspace
 * Requires 'read' permission
 */
export async function GET(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const { id: workspaceId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has read permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.user.$id, "read");

    // Use API key client to access user details
    const client = new Client();
    client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
    const databases = new Databases(client);
    const users = new Users(client);

    // Get all members
    const membersResult = await databases.listDocuments(
      databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [Query.equal("workspace_id", workspaceId)]
    );

    // Fetch user details for each member
    const members = await Promise.all(
      membersResult.documents.map(async (member) => {
        try {
          const user = await users.get(member.user_id);
          return {
            id: member.$id,
            user_id: member.user_id,
            name: user.name || "",
            email: user.email,
            role: member.role,
          };
        } catch {
          return {
            id: member.$id,
            user_id: member.user_id,
            name: "",
            email: "(unknown)",
            role: member.role,
          };
        }
      })
    );

    // Sort: owners first, then admins, then by name
    members.sort((a, b) => {
      const roleOrder = { owner: 0, admin: 1, editor: 2, viewer: 3 };
      const aOrder = roleOrder[a.role as keyof typeof roleOrder] ?? 4;
      const bOrder = roleOrder[b.role as keyof typeof roleOrder] ?? 4;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (a.name || a.email).localeCompare(b.name || b.email);
    });

    return NextResponse.json({ members });
  } catch (error: any) {
    if (error?.message?.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list members:", error);
    return NextResponse.json({ error: "Failed to list members" }, { status: 500 });
  }
}
