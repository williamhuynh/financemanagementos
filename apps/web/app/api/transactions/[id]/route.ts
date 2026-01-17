import { NextResponse } from "next/server";
import { getApiContext } from "../../../../lib/api-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;

  const body = (await request.json()) as {
    category?: string;
    is_transfer?: boolean;
  };
  const updates: Record<string, unknown> = {
    workspace_id: workspaceId
  };

  if (body.category !== undefined) {
    const category = body.category.trim() || "Uncategorised";
    updates.category_name = category;
    updates.needs_review = category === "Uncategorised";
  }

  if (body.is_transfer !== undefined) {
    updates.is_transfer = body.is_transfer;
  }

  if (Object.keys(updates).length === 1) {
    return NextResponse.json(
      { detail: "No updates provided." },
      { status: 400 }
    );
  }

  const { id } = await params;

  await databases.updateDocument(config.databaseId, "transactions", id, updates);

  return NextResponse.json({ ok: true });
}
