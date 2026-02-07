import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext, getServerConfig, createDatabasesClient } from "../../../../lib/api-auth";
import { COLLECTIONS } from "../../../../lib/collection-names";

export const dynamic = "force-dynamic";

/**
 * GET /api/account/export
 * Export all user data as JSON (GDPR data portability).
 * Returns transactions, assets, cash logs, categories, and workspace info
 * for every workspace the user is a member of.
 */
export async function GET() {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const config = getServerConfig();
    if (!config) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const databases = createDatabasesClient(config);
    const { databaseId } = config;

    // Get all workspace memberships for this user
    const memberships = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
      Query.equal("user_id", ctx.user.$id),
      Query.limit(100),
    ]);

    const workspaceIds = memberships.documents.map((m) => m.workspace_id as string);

    const exportData: Record<string, unknown> = {
      exportedAt: new Date().toISOString(),
      user: {
        id: ctx.user.$id,
        email: ctx.user.email,
        name: ctx.user.name,
      },
      workspaces: [],
    };

    const workspaces: unknown[] = [];

    for (const workspaceId of workspaceIds) {
      // Fetch workspace details
      let workspace;
      try {
        workspace = await databases.getDocument(databaseId, COLLECTIONS.WORKSPACES, workspaceId);
      } catch {
        continue;
      }

      // Fetch all collections for this workspace (paginate with limit 5000)
      const fetchAll = async (collection: string) => {
        const results = await databases.listDocuments(databaseId, collection, [
          Query.equal("workspace_id", workspaceId),
          Query.limit(5000),
        ]);
        return results.documents.map((doc) => {
          const { $collectionId, $databaseId, $permissions, ...rest } = doc;
          return rest;
        });
      };

      const [transactions, categories, assets, cashLogs, imports, transferPairs, snapshots] =
        await Promise.all([
          fetchAll(COLLECTIONS.TRANSACTIONS),
          fetchAll(COLLECTIONS.CATEGORIES),
          fetchAll(COLLECTIONS.ASSETS),
          fetchAll(COLLECTIONS.CASH_LOGS),
          fetchAll(COLLECTIONS.IMPORTS),
          fetchAll(COLLECTIONS.TRANSFER_PAIRS),
          fetchAll(COLLECTIONS.MONTHLY_SNAPSHOTS),
        ]);

      // Fetch asset valuations (keyed by asset_id, not workspace_id)
      const assetIds = assets.map((a) => a.$id as string);
      let valuations: unknown[] = [];
      if (assetIds.length > 0) {
        // Fetch in batches of 100
        for (let i = 0; i < assetIds.length; i += 100) {
          const batch = assetIds.slice(i, i + 100);
          const result = await databases.listDocuments(databaseId, "asset_valuations", [
            Query.equal("asset_id", batch),
            Query.limit(5000),
          ]);
          valuations = valuations.concat(
            result.documents.map((doc) => {
              const { $collectionId, $databaseId, $permissions, ...rest } = doc;
              return rest;
            })
          );
        }
      }

      workspaces.push({
        id: workspace.$id,
        name: workspace.name,
        currency: workspace.currency,
        transactions,
        categories,
        assets,
        assetValuations: valuations,
        cashLogs,
        imports,
        transferPairs,
        monthlySnapshots: snapshots,
      });
    }

    exportData.workspaces = workspaces;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="financelab-export-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Data export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}
