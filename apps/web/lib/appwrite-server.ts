import { Client, Databases, Account } from "node-appwrite";
import { getSession } from "./session";

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
 * This reads the Appwrite session from our server-side encrypted session store.
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
