import { NextResponse } from "next/server";
import { getApiContext } from "../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../lib/workspace-guard";
import { createInvitation, listPendingInvitations } from "../../../../../lib/invitation-service";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../../lib/rate-limit";
import { validateBody, InvitationCreateSchema } from "../../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../../lib/audit";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/workspaces/[id]/invitations
 * List pending invitations for a workspace
 * Requires 'admin' permission
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
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const { id: workspaceId } = await context.params;
    const ctx = await getApiContext();

    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user has admin permission for this workspace
    await requireWorkspacePermission(workspaceId, ctx.user.$id, "admin");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = validateBody(InvitationCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { email, role } = parsed.data;

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

    // Fire-and-forget audit log
    writeAuditLog(ctx.databases, ctx.config.databaseId, {
      workspace_id: workspaceId,
      user_id: ctx.user.$id,
      action: "create",
      resource_type: "invitation",
      resource_id: invitation.$id,
      summary: `Invited ${email} as ${role}`,
      metadata: { email, role },
      ip_address: getClientIp(request),
    });

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
