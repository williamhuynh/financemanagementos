import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../../lib/workspace-guard";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // Verify the asset value exists and belongs to the user's workspace
    const existingValues = await databases.listDocuments(
      config.databaseId,
      "asset_values",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingValues.documents.length === 0) {
      return NextResponse.json(
        { detail: "Asset value not found or access denied." },
        { status: 404 }
      );
    }

    await databases.updateDocument(config.databaseId, "asset_values", id, {
      deleted_at: new Date().toISOString()
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
    console.error('Asset value DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
