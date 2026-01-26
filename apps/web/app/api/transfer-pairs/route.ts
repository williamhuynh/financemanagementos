import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');

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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Transfer pairs POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
