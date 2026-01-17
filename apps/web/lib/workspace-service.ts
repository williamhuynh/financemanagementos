import { Client, Databases, Query, ID } from "node-appwrite";

export type WorkspaceMemberRole = "owner" | "admin" | "editor" | "viewer";

export interface Workspace {
  $id: string;
  name: string;
  currency: string;
  owner_id: string;
}

export interface WorkspaceMember {
  $id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceMemberRole;
}

function getServerClient() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    throw new Error("Missing Appwrite server configuration");
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);

  return {
    client,
    databases: new Databases(client),
    databaseId
  };
}

/**
 * Get the workspace ID for a user.
 * Returns the first workspace the user is a member of, or null if none.
 */
export async function getWorkspaceForUser(userId: string): Promise<string | null> {
  const { databases, databaseId } = getServerClient();

  try {
    // Look up workspace membership
    const memberships = await databases.listDocuments(databaseId, "workspace_members", [
      Query.equal("user_id", userId),
      Query.limit(1)
    ]);

    if (memberships.documents.length > 0) {
      return memberships.documents[0].workspace_id as string;
    }

    return null;
  } catch (error) {
    console.error("Error getting workspace for user:", error);
    return null;
  }
}

/**
 * Get all workspaces a user is a member of.
 */
export async function getWorkspacesForUser(userId: string): Promise<Workspace[]> {
  const { databases, databaseId } = getServerClient();

  try {
    // Get all memberships for user
    const memberships = await databases.listDocuments(databaseId, "workspace_members", [
      Query.equal("user_id", userId),
      Query.limit(100)
    ]);

    if (memberships.documents.length === 0) {
      return [];
    }

    // Get workspace details
    const workspaceIds = memberships.documents.map((m) => m.workspace_id as string);
    const workspaces: Workspace[] = [];

    for (const workspaceId of workspaceIds) {
      try {
        const workspace = await databases.getDocument(databaseId, "workspaces", workspaceId);
        workspaces.push({
          $id: workspace.$id,
          name: workspace.name as string,
          currency: workspace.currency as string,
          owner_id: workspace.owner_id as string
        });
      } catch {
        // Skip workspaces that no longer exist
        continue;
      }
    }

    return workspaces;
  } catch (error) {
    console.error("Error getting workspaces for user:", error);
    return [];
  }
}

/**
 * Create a new workspace and add the user as owner.
 */
export async function createWorkspaceForUser(
  userId: string,
  workspaceName: string,
  currency: string = "AUD"
): Promise<Workspace | null> {
  const { databases, databaseId } = getServerClient();

  try {
    // Create the workspace
    const workspaceId = ID.unique();
    const workspace = await databases.createDocument(
      databaseId,
      "workspaces",
      workspaceId,
      {
        name: workspaceName,
        currency,
        owner_id: userId
      }
    );

    // Add user as owner member
    await databases.createDocument(databaseId, "workspace_members", ID.unique(), {
      workspace_id: workspaceId,
      user_id: userId,
      role: "owner"
    });

    return {
      $id: workspace.$id,
      name: workspace.name as string,
      currency: workspace.currency as string,
      owner_id: workspace.owner_id as string
    };
  } catch (error) {
    console.error("Error creating workspace:", error);
    return null;
  }
}

/**
 * Get a workspace by ID.
 */
export async function getWorkspaceById(workspaceId: string): Promise<Workspace | null> {
  const { databases, databaseId } = getServerClient();

  try {
    const workspace = await databases.getDocument(databaseId, "workspaces", workspaceId);
    return {
      $id: workspace.$id,
      name: workspace.name as string,
      currency: workspace.currency as string,
      owner_id: workspace.owner_id as string
    };
  } catch (error) {
    console.error("Error getting workspace:", error);
    return null;
  }
}

/**
 * Check if a user has access to a workspace.
 */
export async function userHasWorkspaceAccess(
  userId: string,
  workspaceId: string
): Promise<boolean> {
  const { databases, databaseId } = getServerClient();

  try {
    const memberships = await databases.listDocuments(databaseId, "workspace_members", [
      Query.equal("user_id", userId),
      Query.equal("workspace_id", workspaceId),
      Query.limit(1)
    ]);

    return memberships.documents.length > 0;
  } catch (error) {
    console.error("Error checking workspace access:", error);
    return false;
  }
}

/**
 * Get a user's role in a workspace.
 */
export async function getUserRoleInWorkspace(
  userId: string,
  workspaceId: string
): Promise<WorkspaceMemberRole | null> {
  const { databases, databaseId } = getServerClient();

  try {
    const memberships = await databases.listDocuments(databaseId, "workspace_members", [
      Query.equal("user_id", userId),
      Query.equal("workspace_id", workspaceId),
      Query.limit(1)
    ]);

    if (memberships.documents.length === 0) {
      return null;
    }

    return memberships.documents[0].role as WorkspaceMemberRole;
  } catch (error) {
    console.error("Error getting user role:", error);
    return null;
  }
}

/**
 * Ensure a user has a workspace, creating one if needed.
 * This is called during the auth flow to guarantee every user has a workspace.
 */
export async function ensureUserHasWorkspace(
  userId: string,
  userName: string
): Promise<string> {
  // Check if user already has a workspace
  const existingWorkspaceId = await getWorkspaceForUser(userId);
  if (existingWorkspaceId) {
    return existingWorkspaceId;
  }

  // Create a new workspace for the user
  const workspace = await createWorkspaceForUser(
    userId,
    `${userName}'s Workspace`,
    "AUD"
  );

  if (!workspace) {
    throw new Error("Failed to create workspace for user");
  }

  return workspace.$id;
}
