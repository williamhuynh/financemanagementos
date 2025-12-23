import { NextResponse } from "next/server";
import { Client, Databases, ID } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";

export async function POST(request: Request) {
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

  const body = (await request.json()) as {
    name?: string;
    type?: string;
    owner?: string;
    currency?: string;
  };

  const name = body.name?.trim();
  const type = body.type?.trim();
  if (!name || !type) {
    return NextResponse.json(
      { detail: "Asset name and type are required." },
      { status: 400 }
    );
  }

  const owner = body.owner?.trim() || "Joint";
  const currency = body.currency?.trim() || "AUD";

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  await databases.createDocument(databaseId, "assets", ID.unique(), {
    workspace_id: DEFAULT_WORKSPACE_ID,
    name,
    type,
    owner,
    status: "active",
    currency,
    disposed_at: ""
  });

  return NextResponse.json({ ok: true });
}
