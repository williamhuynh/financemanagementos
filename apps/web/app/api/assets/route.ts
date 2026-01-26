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

    await databases.createDocument(config.databaseId, "assets", ID.unique(), {
      workspace_id: workspaceId,
      name,
      type,
      owner,
      status: "active",
      currency,
      disposed_at: ""
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Asset POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
