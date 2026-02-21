import { NextResponse } from "next/server";
import { Client, Account, Databases, Query } from "node-appwrite";
import { createSessionClient, getServerConfig, createDatabasesClient } from "../../../lib/api-auth";
import { COLLECTIONS } from "../../../lib/collection-names";
import { getSession } from "../../../lib/session";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/account
 * Delete the current user's account and all associated data.
 *
 * Process:
 * 1. Remove user from all workspaces (memberships)
 * 2. For workspaces where user is the sole owner, delete all workspace data
 * 3. Delete the Appwrite user account
 * 4. Destroy the session
 */
export async function DELETE(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.accountDelete);
  if (blocked) return blocked;

  try {
    const sessionClient = await createSessionClient();
    if (!sessionClient) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionClient.account.get();
    const config = getServerConfig();
    if (!config) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    const databases = createDatabasesClient(config);
    const { databaseId } = config;

    // Get all workspace memberships
    const memberships = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
      Query.equal("user_id", user.$id),
      Query.limit(100),
    ]);

    for (const membership of memberships.documents) {
      const workspaceId = membership.workspace_id as string;

      // Check if user is the sole owner
      const allMembers = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_MEMBERS, [
        Query.equal("workspace_id", workspaceId),
        Query.limit(100),
      ]);

      const otherMembers = allMembers.documents.filter(
        (m) => m.user_id !== user.$id
      );
      const otherOwners = otherMembers.filter((m) => m.role === "owner");

      if (otherMembers.length > 0 && otherOwners.length === 0) {
        // Sole owner but other members exist — cannot leave workspace ownerless
        return NextResponse.json(
          {
            error: `You are the sole owner of a workspace with other members. Transfer ownership before deleting your account.`,
            workspaceId,
          },
          { status: 409 }
        );
      }

      if (otherMembers.length === 0) {
        // Sole member — delete all workspace data and the workspace itself
        await deleteWorkspaceData(databases, databaseId, workspaceId);

        try {
          await databases.deleteDocument(databaseId, COLLECTIONS.WORKSPACES, workspaceId);
        } catch {
          // Workspace may already be deleted
        }
      }

      // Remove the user's membership
      try {
        await databases.deleteDocument(databaseId, COLLECTIONS.WORKSPACE_MEMBERS, membership.$id);
      } catch {
        // Membership may already be deleted
      }
    }

    // Delete any pending invitations sent to this user's email
    try {
      const invitations = await databases.listDocuments(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, [
        Query.equal("email", user.email),
        Query.limit(100),
      ]);
      for (const inv of invitations.documents) {
        await databases.deleteDocument(databaseId, COLLECTIONS.WORKSPACE_INVITATIONS, inv.$id);
      }
    } catch {
      // Non-critical
    }

    // Delete the Appwrite user account using admin API key
    const adminClient = new Client()
      .setEndpoint(config.endpoint)
      .setProject(config.projectId)
      .setKey(config.apiKey);
    const adminUsers = await import("node-appwrite").then((m) => new m.Users(adminClient));

    await adminUsers.delete(user.$id);

    // Destroy the local session
    const session = await getSession();
    session.destroy();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}

/**
 * Delete all data belonging to a workspace.
 */
async function deleteWorkspaceData(
  databases: Databases,
  databaseId: string,
  workspaceId: string
) {
  // Delete asset valuations BEFORE deleting assets (valuations are keyed by asset_id)
  try {
    const assets = await databases.listDocuments(databaseId, COLLECTIONS.ASSETS, [
      Query.equal("workspace_id", workspaceId),
      Query.limit(5000),
    ]);
    for (const asset of assets.documents) {
      const valuations = await databases.listDocuments(databaseId, "asset_valuations", [
        Query.equal("asset_id", asset.$id),
        Query.limit(5000),
      ]);
      await Promise.all(
        valuations.documents.map((v) =>
          databases.deleteDocument(databaseId, "asset_valuations", v.$id).catch(() => {})
        )
      );
    }
  } catch {
    // Non-critical — continue cleanup
  }

  // Now delete all workspace-scoped collections (including assets)
  const collectionsToClean = [
    COLLECTIONS.TRANSACTIONS,
    COLLECTIONS.CATEGORIES,
    COLLECTIONS.ASSETS,
    COLLECTIONS.CASH_LOGS,
    COLLECTIONS.IMPORTS,
    COLLECTIONS.TRANSFER_PAIRS,
    COLLECTIONS.MONTHLY_SNAPSHOTS,
    COLLECTIONS.WORKSPACE_INVITATIONS,
  ];

  for (const collection of collectionsToClean) {
    try {
      let hasMore = true;
      while (hasMore) {
        const docs = await databases.listDocuments(databaseId, collection, [
          Query.equal("workspace_id", workspaceId),
          Query.limit(100),
        ]);

        if (docs.documents.length === 0) {
          hasMore = false;
          break;
        }

        await Promise.all(
          docs.documents.map((doc) =>
            databases.deleteDocument(databaseId, collection, doc.$id).catch(() => {})
          )
        );
      }
    } catch {
      // Continue cleaning other collections even if one fails
    }
  }
}
