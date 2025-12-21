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
    id: "dashboard_cards",
    name: "Dashboard Cards",
    attributes: [
      { type: "string", key: "title", size: 120, required: true },
      { type: "string", key: "value", size: 60, required: true },
      { type: "string", key: "sub", size: 200, required: true },
      { type: "string", key: "tone", size: 40, required: false }
    ]
  },
  {
    id: "ledger_rows",
    name: "Ledger Rows",
    attributes: [
      { type: "string", key: "title", size: 160, required: true },
      { type: "string", key: "sub", size: 200, required: true },
      { type: "string", key: "category", size: 80, required: true },
      { type: "string", key: "amount", size: 40, required: true },
      { type: "string", key: "tone", size: 20, required: true },
      { type: "string", key: "chip", size: 40, required: false },
      { type: "boolean", key: "highlight", required: false }
    ]
  },
  {
    id: "review_items",
    name: "Review Items",
    attributes: [
      { type: "string", key: "title", size: 160, required: true },
      { type: "string", key: "sub", size: 200, required: true },
      { type: "string", key: "amount", size: 40, required: true },
      { type: "string", key: "actions", size: 40, required: true, array: true }
    ]
  },
  {
    id: "asset_cards",
    name: "Asset Cards",
    attributes: [
      { type: "string", key: "title", size: 120, required: true },
      { type: "string", key: "value", size: 60, required: true },
      { type: "string", key: "sub", size: 200, required: true }
    ]
  },
  {
    id: "report_stats",
    name: "Report Stats",
    attributes: [
      { type: "string", key: "title", size: 120, required: true },
      { type: "string", key: "value", size: 60, required: true },
      { type: "string", key: "sub", size: 200, required: true }
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
        attribute.required,
        undefined,
        attribute.array ?? false
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
