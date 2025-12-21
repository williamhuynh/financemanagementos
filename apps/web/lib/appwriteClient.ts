import { Client, Databases } from "appwrite";

const appwriteEndpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
const appwriteProjectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";
const appwriteDatabaseId = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID ?? "";

export const appwriteEnabled = Boolean(
  appwriteEndpoint && appwriteProjectId && appwriteDatabaseId
);

export function getAppwriteClient() {
  if (!appwriteEnabled) {
    return null;
  }

  const client = new Client();
  client.setEndpoint(appwriteEndpoint).setProject(appwriteProjectId);

  return {
    client,
    databases: new Databases(client),
    databaseId: appwriteDatabaseId
  };
}
