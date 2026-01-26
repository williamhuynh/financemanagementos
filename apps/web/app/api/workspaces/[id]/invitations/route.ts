import { NextResponse } from "next/server";
import { getApiContext } from "../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../lib/workspace-guard";
import { createInvitation, listPendingInvitations } from "../../../../../lib/invitation-service";
import type { WorkspaceMemberRole } from "../../../../../lib/workspace-types";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/invitations
 * List pending invitations for a workspace
 * Requires 'admin' permission
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has admin permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.user.$id, "admin");

    const invitations = await listPendingInvitations(
      ctx.databases,
      ctx.config.databaseId,
      workspaceId
    );

    return NextResponse.json({ invitations });
  } catch (error: any) {
    if (error?.message?.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message?.includes("permission")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to list invitations:", error);
    return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
  }
}

/**
 * POST /api/workspaces/[id]/invitations
 * Create a new invitation
 * Requires 'admin' permission
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has admin permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.user.$id, "admin");

    const body = await request.json();
    const { email, role } = body;

    if (!email || !role) {
      return NextResponse.json(
        { error: "Email and role are required" },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles: WorkspaceMemberRole[] = ["owner", "admin", "editor", "viewer"];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: "Invalid role. Must be one of: owner, admin, editor, viewer" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const { invitation, token } = await createInvitation(
      ctx.databases,
      ctx.config.databaseId,
      workspaceId,
      email,
      role,
      ctx.user.$id
    );

    // Build invitation URL (token is included so it can be sent to the invitee)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteUrl = `${baseUrl}/invite/accept?token=${token}`;

    return NextResponse.json({
      success: true,
      invitation: {
        id: invitation.$id,
        email: invitation.email,
        role: invitation.role,
        expires_at: invitation.expires_at,
      },
      inviteUrl,
    });
  } catch (error: any) {
    if (error?.message?.includes("Not a member")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (error?.message?.includes("permission")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Failed to create invitation:", error);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }
}
