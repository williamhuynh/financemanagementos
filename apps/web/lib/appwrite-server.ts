import { Client, Databases, Account } from "node-appwrite";
import { cookies } from "next/headers";

export type ServerAppwriteClient = {
  databases: Databases;
  databaseId: string;
};

export const DEFAULT_WORKSPACE_ID = "default";

export function getServerAppwrite(): ServerAppwriteClient | null {
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

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId };
}

/**
 * Creates a session-based Appwrite client for authenticated requests.
 * This reads the session from cookies and creates a client with user context.
 * Use this for API routes that need to act on behalf of the logged-in user.
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

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(`a_session_${projectId}`);

  if (!sessionCookie) {
    console.log("[SESSION] No session cookie found");
    return null;
  }

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setSession(sessionCookie.value);

  return {
    client,
    account: new Account(client),
    databases: new Databases(client),
    databaseId,
  };
}
