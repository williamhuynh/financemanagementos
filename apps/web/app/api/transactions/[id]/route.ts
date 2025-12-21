import { NextResponse } from "next/server";
import { Client, Databases } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
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

  const body = (await request.json()) as { category?: string };
  const category = body.category?.trim() || "Uncategorised";

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  await databases.updateDocument(databaseId, "transactions", params.id, {
    workspace_id: DEFAULT_WORKSPACE_ID,
    category_name: category,
    needs_review: category === "Uncategorised"
  });

  return NextResponse.json({ ok: true });
}
