import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";

export async function DELETE(
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

  const { id } = await params;
  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  let deletedTransactions = 0;
  let deletedTransferPairs = 0;
  while (true) {
    const page = await databases.listDocuments(databaseId, "transactions", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.equal("import_id", id),
      Query.limit(100)
    ]);
    if (page.documents.length === 0) break;
    for (const doc of page.documents) {
      const transferQueries = [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.equal("from_transaction_id", doc.$id),
        Query.limit(100)
      ];
      while (true) {
        const transferPage = await databases.listDocuments(
          databaseId,
          "transfer_pairs",
          transferQueries
        );
        if (transferPage.documents.length === 0) break;
        for (const transferDoc of transferPage.documents) {
          await databases.deleteDocument(
            databaseId,
            "transfer_pairs",
            transferDoc.$id
          );
          deletedTransferPairs += 1;
        }
      }

      const reverseTransferQueries = [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.equal("to_transaction_id", doc.$id),
        Query.limit(100)
      ];
      while (true) {
        const transferPage = await databases.listDocuments(
          databaseId,
          "transfer_pairs",
          reverseTransferQueries
        );
        if (transferPage.documents.length === 0) break;
        for (const transferDoc of transferPage.documents) {
          await databases.deleteDocument(
            databaseId,
            "transfer_pairs",
            transferDoc.$id
          );
          deletedTransferPairs += 1;
        }
      }

      await databases.deleteDocument(databaseId, "transactions", doc.$id);
      deletedTransactions += 1;
    }
  }

  try {
    await databases.deleteDocument(databaseId, "imports", id);
  } catch (error) {
    if (error?.code !== 404) {
      throw error;
    }
  }

  return NextResponse.json({
    ok: true,
    deletedTransactions,
    deletedTransferPairs
  });
}
