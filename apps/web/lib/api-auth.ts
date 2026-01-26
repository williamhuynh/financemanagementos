import { Client, Account, Databases, Query } from "node-appwrite";
import { getSession } from "./session";
import { COLLECTIONS } from "./collection-names";
import type { ApiConfig, AuthenticatedUser, ApiContext, WorkspaceMemberRole } from "./workspace-types";

/**
 * Get Appwrite server configuration from environment variables.
 */
export function getServerConfig(): ApiConfig | null {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return null;
  }

  return { endpoint, projectId, databaseId, apiKey };
}

/**
 * Creates a session-based Appwrite client for authenticated requests.
 * This reads the Appwrite session from our server-side encrypted session store (iron-session).
 * Use this for API routes that need to act on behalf of the logged-in user.
 *
 * This approach works with Appwrite Cloud since the session is stored server-side,
 * not relying on cross-origin cookies.
 */
export async function createSessionClient() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;

  if (!endpoint || !projectId || !databaseId) {
    throw new Error("Missing Appwrite configuration");
  }

  // Get session from iron-session (server-side encrypted session store)
  const session = await getSession();

  if (!session.isLoggedIn || !session.appwriteSession) {
    return null;
  }

  // Create Appwrite client with the stored session secret
  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setSession(session.appwriteSession);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    databaseId,
  };
}

/**
 * Get authenticated API context including user and workspace.
 * Returns null if not authenticated or no workspace.
 *
 * This function:
 * 1. Gets session-based client for account access (reads from iron-session)
 * 2. Gets authenticated user from Appwrite (using session from iron-session)
 * 3. Gets user preferences (activeWorkspaceId) from Appwrite account
 * 4. Handles missing workspace (for legacy users or first login)
 * 5. Uses API key client to validate workspace membership
 * 6. Returns context with API key databases client (for data access)
 */
export async function getApiContext(): Promise<ApiContext | null> {
  const config = getServerConfig();
  if (!config) {
    return null;
  }

  // 1. Get session-based client for account access (reads from iron-session)
  const sessionClient = await createSessionClient();
  if (!sessionClient) {
    return null;
  }

  // 2. Get authenticated user from Appwrite (using session from iron-session)
  const user = await sessionClient.account.get();

  // 3. Get user preferences (activeWorkspaceId) from Appwrite account
  const prefs = await sessionClient.account.getPrefs();
  let activeWorkspaceId = prefs.activeWorkspaceId;

  // 4. Handle missing workspace (for legacy users or first login)
  if (!activeWorkspaceId) {
    // Try to find an existing workspace for this user
    const adminDatabases = createDatabasesClient(config);
    const memberships = await adminDatabases.listDocuments(
      config.databaseId,
      COLLECTIONS.WORKSPACE_MEMBERS,
      [Query.equal('user_id', user.$id), Query.limit(1)]
    );

    if (memberships.documents.length > 0) {
      activeWorkspaceId = memberships.documents[0].workspace_id as string;
      // Save to prefs for next time
      await sessionClient.account.updatePrefs({ activeWorkspaceId });
    } else {
      // No workspace found - user needs to create one
      // This should not happen if signup flow is correct, but handle gracefully
      return null;
    }
  }

  // 5. Use API key client to validate workspace membership
  const adminDatabases = createDatabasesClient(config);
  const membership = await adminDatabases.listDocuments(
    config.databaseId,
    COLLECTIONS.WORKSPACE_MEMBERS,
    [
      Query.equal('user_id', user.$id),
      Query.equal('workspace_id', activeWorkspaceId),
    ]
  );

  if (membership.documents.length === 0) {
    throw new Error('User not member of active workspace');
  }

  if (membership.documents.length > 1) {
    // Should be prevented by unique index
    console.error('Duplicate workspace memberships found', {
      userId: user.$id,
      workspaceId: activeWorkspaceId,
    });
    throw new Error('Data integrity error: duplicate memberships');
  }

  // 6. Return context with API key databases client (for data access)
  return {
    config,
    user: {
      $id: user.$id,
      email: user.email,
      name: user.name,
    },
    workspaceId: activeWorkspaceId,
    role: membership.documents[0].role as WorkspaceMemberRole,
    databases: adminDatabases,
  };
}

/**
 * Create a server-side Appwrite databases client.
 */
export function createDatabasesClient(config: ApiConfig): Databases {
  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  return new Databases(client);
}
