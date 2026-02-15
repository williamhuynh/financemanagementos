import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, AssetUpdateSchema } from "../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    const body = await request.json();
    const parsed = validateBody(AssetUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, type, owner, currency, status, disposedAt } = parsed.data;

    const updates: Record<string, unknown> = {
      workspace_id: workspaceId
    };

    if (name !== undefined) {
      updates.name = name;
    }
    if (type !== undefined) {
      updates.type = type;
    }
    if (owner !== undefined) {
      updates.owner = owner;
    }
    if (currency !== undefined) {
      updates.currency = currency;
    }
    if (status !== undefined) {
      updates.status = status;
    }
    if (disposedAt !== undefined) {
      updates.disposed_at = disposedAt;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        { detail: "No updates provided." },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Verify the asset exists and belongs to the user's workspace
    const existingAssets = await databases.listDocuments(
      config.databaseId,
      "assets",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingAssets.documents.length === 0) {
      return NextResponse.json(
        { detail: "Asset not found or access denied." },
        { status: 404 }
      );
    }

    await databases.updateDocument(config.databaseId, "assets", id, updates);

    // Fire-and-forget audit log
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "update",
      resource_type: "asset",
      resource_id: id,
      summary: `Updated asset ${id}`,
      metadata: { fields: Object.keys(updates).filter(k => k !== "workspace_id") },
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
    console.error('Asset PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const blocked = rateLimit(request, DATA_RATE_LIMITS.delete);
    if (blocked) return blocked;

    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check delete permission
    await requireWorkspacePermission(workspaceId, user.$id, 'delete');

    const { id } = await params;

    // Verify the asset exists and belongs to the user's workspace
    const existingAssets = await databases.listDocuments(
      config.databaseId,
      "assets",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingAssets.documents.length === 0) {
      return NextResponse.json(
        { detail: "Asset not found or access denied." },
        { status: 404 }
      );
    }

    const deletedAt = new Date().toISOString();

    let offset = 0;
    while (true) {
      const response = await databases.listDocuments(
        config.databaseId,
        "asset_values",
        [
          Query.equal("workspace_id", workspaceId),
          Query.equal("asset_id", id),
          Query.limit(100),
          Query.offset(offset)
        ]
      );
      const documents = response?.documents ?? [];
      if (documents.length === 0) {
        break;
      }
      for (const doc of documents) {
        await databases.updateDocument(
          config.databaseId,
          "asset_values",
          String(doc.$id ?? ""),
          { deleted_at: deletedAt }
        );
      }
      offset += documents.length;
      if (offset >= (response?.total ?? 0)) {
        break;
      }
    }

    await databases.updateDocument(config.databaseId, "assets", id, {
      deleted_at: deletedAt
    });

    // Fire-and-forget audit log
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "delete",
      resource_type: "asset",
      resource_id: id,
      summary: `Deleted asset ${id} and its valuations`,
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
    console.error('Asset DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
