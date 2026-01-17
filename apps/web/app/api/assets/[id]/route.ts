import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    owner?: string;
    currency?: string;
    status?: string;
    disposedAt?: string;
  };

  const updates: Record<string, unknown> = {
    workspace_id: workspaceId
  };

  if (body.name !== undefined) {
    updates.name = body.name.trim();
  }
  if (body.type !== undefined) {
    updates.type = body.type.trim();
  }
  if (body.owner !== undefined) {
    updates.owner = body.owner.trim();
  }
  if (body.currency !== undefined) {
    updates.currency = body.currency.trim();
  }
  if (body.status !== undefined) {
    updates.status = body.status.trim();
  }
  if (body.disposedAt !== undefined) {
    updates.disposed_at = body.disposedAt.trim();
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { detail: "No updates provided." },
      { status: 400 }
    );
  }

  const { id } = await params;

  await databases.updateDocument(config.databaseId, "assets", id, updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;
  const { id } = await params;
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

  return NextResponse.json({ ok: true });
}
