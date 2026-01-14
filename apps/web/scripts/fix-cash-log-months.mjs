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

async function listCashLogs() {
  const logs = [];
  let offset = 0;
  while (true) {
    const response = await databases.listDocuments(databaseId, "cash_logs", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.limit(100),
      Query.offset(offset)
    ]);
    const documents = response?.documents ?? [];
    logs.push(...documents);
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }
  return logs;
}

async function run() {
  console.log("Fetching all cash logs...");
  const logs = await listCashLogs();
  console.log(`Found ${logs.length} cash log entries.`);

  let updated = 0;
  let skipped = 0;

  for (const log of logs) {
    const date = String(log.date ?? "").trim();
    const currentMonth = String(log.month ?? "").trim();

    if (!date || date.length < 7) {
      console.log(`Skipping log ${log.$id}: invalid date "${date}"`);
      skipped++;
      continue;
    }

    // Extract correct month from date string (YYYY-MM-DD -> YYYY-MM)
    const correctMonth = date.substring(0, 7);

    if (currentMonth === correctMonth) {
      // Already correct
      skipped++;
      continue;
    }

    console.log(
      `Fixing log ${log.$id}: "${currentMonth}" -> "${correctMonth}" (date: ${date})`
    );

    await databases.updateDocument(databaseId, "cash_logs", log.$id, {
      month: correctMonth
    });
    updated++;
  }

  console.log(`\nMigration complete!`);
  console.log(`Updated: ${updated} entries`);
  console.log(`Skipped: ${skipped} entries (already correct or invalid)`);
}

run().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
