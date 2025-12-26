import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_WORKSPACE_ID = "default";

export async function GET() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const names = new Set<string>();
  let offset = 0;

  while (true) {
    const response = await databases.listDocuments(databaseId, "transactions", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
      Query.offset(offset)
    ]);
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      const name = String(doc.account_name ?? "").trim();
      if (name) {
        names.add(name);
      }
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }

  return NextResponse.json(
    {
      accounts: Array.from(names).sort((a, b) => a.localeCompare(b))
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    }
  );
}
