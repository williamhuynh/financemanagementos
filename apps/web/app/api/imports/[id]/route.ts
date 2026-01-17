import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";

function isNotFoundError(error: unknown): error is { code: number } {
  if (typeof error !== "object" || error === null) return false;
  return "code" in error && (error as { code?: number }).code === 404;
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

  return NextResponse.json({
    ok: true,
    deletedTransactions,
    deletedTransferPairs
  });
}
