import { NextResponse } from "next/server";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../../lib/collection-names";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.delete);
  if (blocked) return blocked;

  try {
    // Authentication and workspace context
    const context = await getApiContext();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { user, workspaceId, databases, config } = context;

    // Verify user has delete permission
    await requireWorkspacePermission(workspaceId, user.$id, 'delete');

    const { id } = await params;

    // Verify the transfer pair belongs to user's workspace before deletion
    const transferPair = await databases.getDocument(
      config.databaseId,
      COLLECTIONS.TRANSFER_PAIRS,
      id
    );

    if (transferPair.workspace_id !== workspaceId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Delete the transfer pair
    await databases.deleteDocument(config.databaseId, COLLECTIONS.TRANSFER_PAIRS, id);

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "delete",
      resource_type: "transfer_pair",
      resource_id: id,
      summary: `Deleted transfer pair ${id}`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    if (error.message?.includes('not member')) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }
    if (error.message?.includes('Insufficient permission')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    if (error.message?.includes('Document with the requested ID')) {
      return NextResponse.json({ error: 'Transfer pair not found' }, { status: 404 });
    }
    console.error('Transfer pair deletion error:', error);
    return NextResponse.json(
      { error: 'Failed to delete transfer pair' },
      { status: 500 }
    );
  }
}
