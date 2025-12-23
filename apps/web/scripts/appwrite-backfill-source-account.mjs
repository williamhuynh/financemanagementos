import "./load-env.mjs";
import { Client, Databases, Query } from "node-appwrite";

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

const DEFAULT_WORKSPACE_ID = "default";

async function listImports() {
  const imports = [];
  let offset = 0;
  while (true) {
    const response = await databases.listDocuments(databaseId, "imports", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.limit(100),
      Query.offset(offset)
    ]);
    const documents = response?.documents ?? [];
    imports.push(...documents);
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }
  return imports;
}

async function backfillImport(importDoc) {
  const importId = String(importDoc.$id ?? "");
  const sourceAccount = String(importDoc.source_account ?? "").trim();
  if (!importId || !sourceAccount) {
    return 0;
  }

  let updated = 0;
  let offset = 0;
  while (true) {
    const response = await databases.listDocuments(databaseId, "transactions", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.equal("import_id", importId),
      Query.limit(100),
      Query.offset(offset)
    ]);
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      const existing = String(doc.source_account ?? "").trim();
      if (existing) {
        continue;
      }
      await databases.updateDocument(databaseId, "transactions", doc.$id, {
        source_account: sourceAccount
      });
      updated += 1;
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }
  return updated;
}

async function run() {
  const imports = await listImports();
  let totalUpdated = 0;
  for (const importDoc of imports) {
    totalUpdated += await backfillImport(importDoc);
  }
  console.log(`Backfilled source_account on ${totalUpdated} transactions.`);
}

run().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
