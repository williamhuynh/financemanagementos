import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, TransferPairCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    const body = await request.json();
    const parsed = validateBody(TransferPairCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { fromId, toId } = parsed.data!;

    const transferDoc = {
      workspace_id: workspaceId,
      from_transaction_id: fromId,
      to_transaction_id: toId,
      matched_at: new Date().toISOString()
    };

    const created = await databases.createDocument(
      config.databaseId,
      "transfer_pairs",
      ID.unique(),
      transferDoc
    );

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "transfer_pair",
      resource_id: created.$id,
      summary: `Created transfer pair from ${fromId} to ${toId}`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true, id: created.$id });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Transfer pairs POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
