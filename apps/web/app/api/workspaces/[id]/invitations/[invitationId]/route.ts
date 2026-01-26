import { NextResponse } from "next/server";
import { getApiContext } from "../../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../../lib/workspace-guard";
import { cancelInvitation } from "../../../../../../lib/invitation-service";
import { COLLECTIONS } from "../../../../../../lib/collection-names";

type RouteContext = { params: Promise<{ id: string; invitationId: string }> };

/**
 * DELETE /api/workspaces/[id]/invitations/[invitationId]
 * Cancel a pending invitation
 * Requires 'admin' permission
 */
export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { id: workspaceId, invitationId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has admin permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.userId, "admin");

    // Verify the invitation belongs to this workspace
    try {
      const invitation = await ctx.databases.getDocument(
        ctx.databaseId,
        COLLECTIONS.WORKSPACE_INVITATIONS,
        invitationId
      );

      if (invitation.workspace_id !== workspaceId) {
        return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
    }

    await cancelInvitation(ctx.databases, ctx.databaseId, invitationId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error?.message?.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message?.includes("permission")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to cancel invitation:", error);
    return NextResponse.json({ error: "Failed to cancel invitation" }, { status: 500 });
  }
}
