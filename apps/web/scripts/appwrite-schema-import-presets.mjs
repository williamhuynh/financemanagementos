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
  id: "import_presets",
  name: "Import Presets",
  attributes: [
    { type: "string", key: "workspace_id", size: 64, required: true },
    { type: "string", key: "name", size: 200, required: true },
    { type: "string", key: "header_map", size: 5000, required: true },
    { type: "boolean", key: "invert_amount", required: true },
    { type: "string", key: "created_by", size: 64, required: true },
  ]
};

async function createCollectionIfMissing() {
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
      return;
    }

    if (attribute.type === "boolean") {
      await databases.createBooleanAttribute(
        databaseId,
        collection.id,
        attribute.key,
        attribute.required
      );
      console.log(`Added boolean attribute: ${collection.id}.${attribute.key}`);
      return;
    }
  } catch (error) {
    if (error?.code !== 409) {
      throw error;
    }
    console.log(`Attribute exists: ${collection.id}.${attribute.key}`);
  }
}

async function run() {
  await createCollectionIfMissing();
  for (const attribute of collection.attributes) {
    await createAttributeIfMissing(attribute);
  }
  console.log("\nImport presets schema setup complete!");
  console.log("\nThe 'header_map' field stores a JSON string mapping CSV headers to column types.");
}

run().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
