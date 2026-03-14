import "./load-env.mjs";
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

const collection = {
  id: "suggestions",
  name: "Suggestions",
  attributes: [
    { type: "string", key: "workspace_id", size: 64, required: true },
    { type: "string", key: "user_id", size: 64, required: true },
    { type: "string", key: "user_name", size: 128, required: true },
    { type: "string", key: "title", size: 200, required: true },
    { type: "string", key: "description", size: 2000, required: true },
    { type: "string", key: "status", size: 20, required: true },
    // JSON array of user IDs who upvoted, e.g. '["uid1","uid2"]'
    { type: "string", key: "upvoted_by", size: 10000, required: true },
  ],
};

async function createCollectionIfMissing() {
  try {
    await databases.createCollection(databaseId, collection.id, collection.name);
    console.log(`Created collection: ${collection.id}`);
  } catch (error) {
    if (error?.code !== 409) throw error;
    console.log(`Collection exists: ${collection.id}`);
  }
}

async function createAttributeIfMissing(attribute) {
  try {
    if (attribute.type === "string") {
      await databases.createStringAttribute(
        databaseId,
        collection.id,
        attribute.key,
        attribute.size,
        attribute.required
      );
      console.log(`Added string attribute: ${collection.id}.${attribute.key}`);
    }
  } catch (error) {
    if (error?.code !== 409) throw error;
    console.log(`Attribute exists: ${collection.id}.${attribute.key}`);
  }
}

async function createIndexIfMissing(key, type, attributes) {
  try {
    await databases.createIndex(databaseId, collection.id, key, type, attributes);
    console.log(`Created index: ${collection.id}.${key}`);
  } catch (error) {
    if (error?.code !== 409) throw error;
    console.log(`Index exists: ${collection.id}.${key}`);
  }
}

async function run() {
  await createCollectionIfMissing();

  for (const attribute of collection.attributes) {
    await createAttributeIfMissing(attribute);
    // Small delay to allow Appwrite to provision the attribute
    await new Promise((r) => setTimeout(r, 500));
  }

  // Wait for attributes to be fully provisioned before creating indexes
  console.log("\nWaiting for attributes to provision...");
  await new Promise((r) => setTimeout(r, 3000));

  await createIndexIfMissing("idx_workspace_id", "key", ["workspace_id"]);
  await createIndexIfMissing("idx_status", "key", ["status"]);

  console.log("\nSuggestions schema setup complete!");
  console.log("\nIMPORTANT: The 'upvoted_by' field is required and must be a JSON string.");
  console.log("When creating new suggestions, use '[]' as the default value for upvoted_by.");
}

run().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
