import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../lib/workspace-service";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, AssetCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

export async function POST(request: Request) {
  try {
    const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
    if (blocked) return blocked;

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
    const parsed = validateBody(AssetCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, type, owner: rawOwner, currency: rawCurrency } = parsed.data;

    const workspace = await getWorkspaceById(workspaceId);
    const workspaceCurrency = workspace?.currency ?? "AUD";
    const owner = rawOwner || "Joint";
    const currency = rawCurrency || workspaceCurrency;

    const doc = await databases.createDocument(config.databaseId, "assets", ID.unique(), {
      workspace_id: workspaceId,
      name,
      type,
      owner,
      status: "active",
      currency,
      disposed_at: ""
    });

    // Fire-and-forget audit log
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "asset",
      resource_id: doc.$id,
      summary: `Created asset "${name}" (${type})`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Asset POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
