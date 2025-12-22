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
    fromId?: string;
    toId?: string;
  };
  if (!body.fromId || !body.toId) {
    return NextResponse.json(
      { detail: "Missing transfer pair identifiers." },
      { status: 400 }
    );
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const transferDoc = {
    workspace_id: DEFAULT_WORKSPACE_ID,
    from_transaction_id: body.fromId,
    to_transaction_id: body.toId,
    matched_at: new Date().toISOString()
  };

  const created = await databases.createDocument(
    databaseId,
    "transfer_pairs",
    ID.unique(),
    transferDoc
  );

  return NextResponse.json({ ok: true, id: created.$id });
}
