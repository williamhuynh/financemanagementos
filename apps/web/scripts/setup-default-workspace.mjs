/**
 * Setup script to create a workspace for existing "default" data.
 * This links existing users to the default workspace so their data continues to work.
 *
 * Usage: node scripts/setup-default-workspace.mjs
 */

import "./load-env.mjs";
import { Client, Databases, Query, Users } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId = process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId = process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  console.error("Missing Appwrite env vars.");
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

const databases = new Databases(client);
const users = new Users(client);

const DEFAULT_WORKSPACE_ID = "default";

async function main() {
  console.log("Setting up default workspace for existing data...\n");

  // 1. Check if workspace already exists
  try {
    const existing = await databases.getDocument(databaseId, "workspaces", DEFAULT_WORKSPACE_ID);
    console.log(`Workspace "${DEFAULT_WORKSPACE_ID}" already exists: ${existing.name}`);
  } catch (error) {
    if (error.code === 404) {
      // Create the workspace
      console.log(`Creating workspace with ID "${DEFAULT_WORKSPACE_ID}"...`);
      await databases.createDocument(databaseId, "workspaces", DEFAULT_WORKSPACE_ID, {
        name: "Family Finances",
        currency: "AUD",
        owner_id: "system"
      });
      console.log("Workspace created!");
    } else {
      throw error;
    }
  }

  // 2. Get all users and add them as workspace members
  console.log("\nFetching users...");
  const userList = await users.list();

  for (const user of userList.users) {
    console.log(`\nProcessing user: ${user.email}`);

    // Check if membership already exists
    const memberships = await databases.listDocuments(databaseId, "workspace_members", [
      Query.equal("user_id", user.$id),
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.limit(1)
    ]);

    if (memberships.documents.length > 0) {
      console.log(`  Already a member (role: ${memberships.documents[0].role})`);
      continue;
    }

    // Add as owner (first user) or admin (subsequent users)
    const role = userList.users.indexOf(user) === 0 ? "owner" : "admin";

    await databases.createDocument(databaseId, "workspace_members", `member_${user.$id}`, {
      workspace_id: DEFAULT_WORKSPACE_ID,
      user_id: user.$id,
      role
    });
    console.log(`  Added as ${role}`);
  }

  console.log("\n✓ Setup complete!");
  console.log("\nYour existing data with workspace_id='default' will now be accessible.");
}

main().catch((error) => {
  console.error("Setup failed:", error);
  process.exit(1);
});
