import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

function isNotFoundError(error: unknown): error is { code: number } {
  if (typeof error !== "object" || error === null) return false;
  return "code" in error && (error as { code?: number }).code === 404;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.delete);
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
    const { id } = await params;

    // Check delete permission
    await requireWorkspacePermission(workspaceId, user.$id, 'delete');

    // Verify the import exists and belongs to the user's workspace before deleting its associated data
    const existingImports = await databases.listDocuments(
      config.databaseId,
      "imports",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingImports.documents.length === 0) {
      return NextResponse.json(
        { error: "Import not found or access denied." },
        { status: 404 }
      );
    }

    let deletedTransactions = 0;
    let deletedTransferPairs = 0;
    while (true) {
    const page = await databases.listDocuments(config.databaseId, "transactions", [
      Query.equal("workspace_id", workspaceId),
      Query.equal("import_id", id),
      Query.limit(100)
    ]);
    if (page.documents.length === 0) break;
    for (const doc of page.documents) {
      const transferQueries = [
        Query.equal("workspace_id", workspaceId),
        Query.equal("from_transaction_id", doc.$id),
        Query.limit(100)
      ];
      while (true) {
        const transferPage = await databases.listDocuments(
          config.databaseId,
          "transfer_pairs",
          transferQueries
        );
        if (transferPage.documents.length === 0) break;
        for (const transferDoc of transferPage.documents) {
          await databases.deleteDocument(
            config.databaseId,
            "transfer_pairs",
            transferDoc.$id
          );
          deletedTransferPairs += 1;
        }
      }

      const reverseTransferQueries = [
        Query.equal("workspace_id", workspaceId),
        Query.equal("to_transaction_id", doc.$id),
        Query.limit(100)
      ];
      while (true) {
        const transferPage = await databases.listDocuments(
          config.databaseId,
          "transfer_pairs",
          reverseTransferQueries
        );
        if (transferPage.documents.length === 0) break;
        for (const transferDoc of transferPage.documents) {
          await databases.deleteDocument(
            config.databaseId,
            "transfer_pairs",
            transferDoc.$id
          );
          deletedTransferPairs += 1;
        }
      }

      await databases.deleteDocument(config.databaseId, "transactions", doc.$id);
      deletedTransactions += 1;
    }
  }

    try {
      await databases.deleteDocument(config.databaseId, "imports", id);
    } catch (error) {
      if (!isNotFoundError(error)) {
        throw error;
      }
    }

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "delete",
      resource_type: "import",
      resource_id: id,
      summary: `Deleted import ${id} (${deletedTransactions} transactions, ${deletedTransferPairs} transfer pairs)`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      ok: true,
      deletedTransactions,
      deletedTransferPairs
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Import DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
