import "./load-env.mjs";
import { Client, Databases, IndexType } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId =
  process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId =
  process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  console.error("Missing Appwrite env vars.");
  console.error(
    "Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_API_KEY."
  );
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

/**
 * Define indexes to create
 * Each index has:
 * - collectionId: The collection to add the index to
 * - key: Unique identifier for the index
 * - type: IndexType.Unique, IndexType.Key, or IndexType.Fulltext
 * - attributes: Array of attribute keys to index
 * - orders: Optional array of sort orders ('ASC' or 'DESC')
 */
const indexes = [
  {
    collectionId: "workspace_members",
    key: "unique_user_workspace",
    type: IndexType.Unique,
    attributes: ["workspace_id", "user_id"],
    description: "CRITICAL: Prevents duplicate memberships - ensures each user can only be a member once per workspace"
  },
  {
    collectionId: "workspace_members",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for all members of a workspace"
  },
  {
    collectionId: "workspace_members",
    key: "idx_user_id",
    type: IndexType.Key,
    attributes: ["user_id"],
    description: "Optimizes queries for all workspaces a user belongs to"
  },
  {
    collectionId: "workspaces",
    key: "idx_owner_id",
    type: IndexType.Key,
    attributes: ["owner_id"],
    description: "Optimizes queries for workspaces owned by a user"
  },
  {
    collectionId: "accounts",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for accounts in a workspace"
  },
  {
    collectionId: "categories",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for categories in a workspace"
  },
  {
    collectionId: "transactions",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for transactions in a workspace"
  },
  {
    collectionId: "transactions",
    key: "idx_workspace_date",
    type: IndexType.Key,
    attributes: ["workspace_id", "date"],
    description: "Optimizes queries for transactions by workspace and date"
  },
  {
    collectionId: "imports",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for imports in a workspace"
  },
  {
    collectionId: "assets",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for assets in a workspace"
  },
  {
    collectionId: "asset_values",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for asset values in a workspace"
  },
  {
    collectionId: "transfer_pairs",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for transfer pairs in a workspace"
  },
  {
    collectionId: "monthly_closes",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for monthly closes in a workspace"
  },
  {
    collectionId: "monthly_closes",
    key: "unique_workspace_month",
    type: IndexType.Unique,
    attributes: ["workspace_id", "month"],
    description: "Ensures only one monthly close record per workspace per month"
  },
  {
    collectionId: "category_rules",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for category rules in a workspace"
  },
  {
    collectionId: "workspace_invitations",
    key: "idx_workspace_id",
    type: IndexType.Key,
    attributes: ["workspace_id"],
    description: "Optimizes queries for invitations in a workspace"
  },
  {
    collectionId: "workspace_invitations",
    key: "idx_email",
    type: IndexType.Key,
    attributes: ["email"],
    description: "Optimizes queries for pending invitations by email"
  },
  {
    collectionId: "workspace_invitations",
    key: "idx_token_hash",
    type: IndexType.Key,
    attributes: ["token_hash"],
    description: "Optimizes lookup of invitations by token"
  }
];

async function createIndexIfMissing(index) {
  try {
    await databases.createIndex(
      databaseId,
      index.collectionId,
      index.key,
      index.type,
      index.attributes,
      index.orders || []
    );
    console.log(`✅ Created index: ${index.collectionId}.${index.key}`);
    console.log(`   ${index.description}`);
    return { status: 'created' };
  } catch (error) {
    if (error?.code === 409) {
      console.log(`⏭️  Index exists: ${index.collectionId}.${index.key}`);
      return { status: 'exists' };
    } else if (error?.type === 'attribute_not_available') {
      console.log(`⏳ Skipped (attribute pending): ${index.collectionId}.${index.key}`);
      return { status: 'pending' };
    } else {
      console.error(`❌ Failed to create index: ${index.collectionId}.${index.key}`);
      console.error(`   Error: ${error.message}`);
      return { status: 'failed', error: error.message };
    }
  }
}

async function run() {
  console.log("\n🔧 Creating database indexes...\n");

  const counts = { created: 0, exists: 0, pending: 0, failed: 0 };

  for (const index of indexes) {
    const result = await createIndexIfMissing(index);
    counts[result.status]++;
  }

  console.log("\n✨ Index creation complete!");
  console.log(`   Created: ${counts.created}, Already existed: ${counts.exists}, Pending: ${counts.pending}, Failed: ${counts.failed}\n`);

  if (counts.pending > 0) {
    console.log("⚠️  Some indexes were skipped because attributes are still provisioning.");
    console.log("   Re-run this script later to create them.\n");
  }
}

run().catch((error) => {
  console.error("\n❌ Index creation failed:", error);
  process.exit(1);
});
