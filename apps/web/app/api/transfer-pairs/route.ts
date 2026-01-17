import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";

export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;

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

  const transferDoc = {
    workspace_id: workspaceId,
    from_transaction_id: body.fromId,
    to_transaction_id: body.toId,
    matched_at: new Date().toISOString()
  };

  const created = await databases.createDocument(
    config.databaseId,
    "transfer_pairs",
    ID.unique(),
    transferDoc
  );

  return NextResponse.json({ ok: true, id: created.$id });
}
