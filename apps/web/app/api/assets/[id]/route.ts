import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    owner?: string;
    currency?: string;
    status?: string;
    disposedAt?: string;
  };

  const updates: Record<string, unknown> = {
    workspace_id: DEFAULT_WORKSPACE_ID
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

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const { id } = await params;

  await databases.updateDocument(databaseId, "assets", id, updates);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const { id } = await params;
  const deletedAt = new Date().toISOString();

  let offset = 0;
  while (true) {
    const response = await databases.listDocuments(
      databaseId,
      "asset_values",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
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
        databaseId,
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

  await databases.updateDocument(databaseId, "assets", id, {
    deleted_at: deletedAt
  });

  return NextResponse.json({ ok: true });
}
