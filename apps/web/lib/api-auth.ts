import { Client, Account, Databases, Query } from "node-appwrite";
import { cookies, headers } from "next/headers";

export interface ApiConfig {
  endpoint: string;
  projectId: string;
  databaseId: string;
  apiKey: string;
}

export interface AuthenticatedUser {
  $id: string;
  email: string;
  name: string;
}

export interface ApiContext {
  config: ApiConfig;
  user: AuthenticatedUser;
  workspaceId: string;
  databases: Databases;
}

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
 * Get the current authenticated user from session cookies or Authorization header.
 */
export async function getCurrentUser(
  config: ApiConfig
): Promise<AuthenticatedUser | null> {
  // Try to get session from Authorization header first (for Appwrite Cloud)
  let sessionToken: string | null = null;

  const headerStore = await headers();
  const authHeader = headerStore.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    sessionToken = authHeader.substring(7);
  }

  // Fall back to cookie-based session (for self-hosted Appwrite)
  if (!sessionToken) {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(`a_session_${config.projectId}`);
    sessionToken = sessionCookie?.value ?? null;
  }

  if (!sessionToken) {
    return null;
  }

  try {
    const client = new Client();
    client.setEndpoint(config.endpoint).setProject(config.projectId);
    client.setSession(sessionToken);

    const account = new Account(client);
    const user = await account.get();

    return {
      $id: user.$id,
      email: user.email,
      name: user.name
    };
  } catch {
    return null;
  }
}

/**
 * Get the workspace ID for a user.
 */
export async function getWorkspaceForUser(
  databases: Databases,
  databaseId: string,
  userId: string
): Promise<string | null> {
  try {
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
 * Get authenticated API context including user and workspace.
 * Returns null if not authenticated or no workspace.
 */
export async function getApiContext(): Promise<ApiContext | null> {
  const config = getServerConfig();
  if (!config) {
    return null;
  }

  const user = await getCurrentUser(config);
  if (!user) {
    return null;
  }

  const client = new Client();
  client.setEndpoint(config.endpoint).setProject(config.projectId).setKey(config.apiKey);
  const databases = new Databases(client);

  const workspaceId = await getWorkspaceForUser(databases, config.databaseId, user.$id);
  if (!workspaceId) {
    return null;
  }

  return {
    config,
    user,
    workspaceId,
    databases
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
