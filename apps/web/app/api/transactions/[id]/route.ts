import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;

    await requireWorkspacePermission(workspaceId, user.$id, "delete");

    const { id } = await params;

    const existing = await databases.listDocuments(
      config.databaseId,
      "transactions",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existing.documents.length === 0) {
      return NextResponse.json(
        { error: "Transaction not found or access denied." },
        { status: 404 }
      );
    }

    await databases.deleteDocument(config.databaseId, "transactions", id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Transaction DELETE error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
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

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

    const body = (await request.json()) as {
      category?: string;
      is_transfer?: boolean;
    };
    const updates: Record<string, unknown> = {
      workspace_id: workspaceId
    };

    if (body.category !== undefined) {
      const category = body.category.trim() || "Uncategorised";
      updates.category_name = category;
      updates.needs_review = category === "Uncategorised";
    }

    if (body.is_transfer !== undefined) {
      updates.is_transfer = body.is_transfer;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json(
        { detail: "No updates provided." },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Verify the transaction exists and belongs to the user's workspace
    const existingTransactions = await databases.listDocuments(
      config.databaseId,
      "transactions",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingTransactions.documents.length === 0) {
      return NextResponse.json(
        { detail: "Transaction not found or access denied." },
        { status: 404 }
      );
    }

    await databases.updateDocument(config.databaseId, "transactions", id, updates);

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
    console.error('Transaction PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
