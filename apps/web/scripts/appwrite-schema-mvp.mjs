import { Client, Databases } from "node-appwrite";

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

const collections = [
  {
    id: "workspaces",
    name: "Workspaces",
    attributes: [
      { type: "string", key: "name", size: 120, required: true },
      { type: "string", key: "currency", size: 8, required: true },
      { type: "string", key: "owner_id", size: 64, required: true }
    ]
  },
  {
    id: "workspace_members",
    name: "Workspace Members",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "user_id", size: 64, required: true },
      { type: "string", key: "role", size: 32, required: true }
    ]
  },
  {
    id: "accounts",
    name: "Accounts",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "name", size: 120, required: true },
      { type: "string", key: "institution", size: 120, required: false },
      { type: "string", key: "type", size: 40, required: false },
      { type: "string", key: "currency", size: 8, required: false },
      { type: "string", key: "last4", size: 8, required: false }
    ]
  },
  {
    id: "categories",
    name: "Categories",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "name", size: 80, required: true },
      { type: "string", key: "group", size: 80, required: false },
      { type: "string", key: "color", size: 16, required: false }
    ]
  },
  {
    id: "category_rules",
    name: "Category Rules",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "pattern", size: 200, required: true },
      { type: "string", key: "match_type", size: 40, required: true },
      { type: "string", key: "category_name", size: 80, required: true },
      { type: "integer", key: "priority", required: false }
    ]
  },
  {
    id: "imports",
    name: "Imports",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "source_name", size: 80, required: true },
      { type: "string", key: "source_account", size: 120, required: false },
      { type: "string", key: "source_owner", size: 40, required: false },
      { type: "string", key: "file_name", size: 160, required: false },
      { type: "integer", key: "row_count", required: true },
      { type: "string", key: "status", size: 40, required: true },
      { type: "string", key: "uploaded_at", size: 40, required: true }
    ]
  },
  {
    id: "transactions",
    name: "Transactions",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "import_id", size: 64, required: true },
      { type: "string", key: "date", size: 40, required: true },
      { type: "string", key: "description", size: 200, required: true },
      { type: "string", key: "amount", size: 40, required: true },
      { type: "string", key: "currency", size: 8, required: false },
      { type: "string", key: "account_name", size: 120, required: false },
      { type: "string", key: "source_account", size: 120, required: false },
      { type: "string", key: "source_owner", size: 40, required: false },
      { type: "string", key: "category_name", size: 80, required: false },
      { type: "string", key: "direction", size: 12, required: false },
      { type: "string", key: "notes", size: 200, required: false },
      { type: "boolean", key: "is_transfer", required: false },
      { type: "boolean", key: "needs_review", required: false }
    ]
  },
  {
    id: "transfer_pairs",
    name: "Transfer Pairs",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "from_transaction_id", size: 64, required: true },
      { type: "string", key: "to_transaction_id", size: 64, required: true },
      { type: "string", key: "matched_at", size: 40, required: true }
    ]
  },
  {
    id: "assets",
    name: "Assets",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "name", size: 120, required: true },
      { type: "string", key: "type", size: 60, required: true },
      { type: "string", key: "owner", size: 40, required: true },
      { type: "string", key: "status", size: 20, required: true },
      { type: "string", key: "currency", size: 8, required: false },
      { type: "string", key: "disposed_at", size: 40, required: false },
      { type: "string", key: "deleted_at", size: 40, required: false }
    ]
  },
  {
    id: "asset_values",
    name: "Asset Values",
    attributes: [
      { type: "string", key: "workspace_id", size: 64, required: true },
      { type: "string", key: "asset_id", size: 64, required: false },
      { type: "string", key: "asset_name", size: 120, required: true },
      { type: "string", key: "asset_type", size: 60, required: false },
      { type: "string", key: "value", size: 60, required: true },
      { type: "string", key: "currency", size: 8, required: false },
      { type: "string", key: "original_value", size: 60, required: false },
      { type: "string", key: "original_currency", size: 8, required: false },
      { type: "string", key: "value_aud", size: 60, required: false },
      { type: "string", key: "fx_rate", size: 40, required: false },
      { type: "string", key: "fx_source", size: 60, required: false },
      { type: "string", key: "recorded_at", size: 40, required: true },
      { type: "string", key: "source", size: 40, required: false },
      { type: "string", key: "notes", size: 200, required: false },
      { type: "string", key: "deleted_at", size: 40, required: false }
    ]
  }
];

async function createCollectionIfMissing(collection) {
  try {
    await databases.createCollection(databaseId, collection.id, collection.name);
    console.log(`Created collection: ${collection.id}`);
  } catch (error) {
    if (error?.code !== 409) {
      throw error;
    }
    console.log(`Collection exists: ${collection.id}`);
  }
}

async function createAttributeIfMissing(collectionId, attribute) {
  try {
    if (attribute.type === "string") {
      await databases.createStringAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.size,
        attribute.required
      );
      console.log(`Added string attribute: ${collectionId}.${attribute.key}`);
      return;
    }

    if (attribute.type === "boolean") {
      await databases.createBooleanAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required
      );
      console.log(`Added boolean attribute: ${collectionId}.${attribute.key}`);
      return;
    }

    if (attribute.type === "integer") {
      await databases.createIntegerAttribute(
        databaseId,
        collectionId,
        attribute.key,
        attribute.required
      );
      console.log(`Added integer attribute: ${collectionId}.${attribute.key}`);
    }
  } catch (error) {
    if (error?.code !== 409) {
      throw error;
    }
    console.log(`Attribute exists: ${collectionId}.${attribute.key}`);
  }
}

async function run() {
  for (const collection of collections) {
    await createCollectionIfMissing(collection);
    for (const attribute of collection.attributes) {
      await createAttributeIfMissing(collection.id, attribute);
    }
  }
}

run().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
