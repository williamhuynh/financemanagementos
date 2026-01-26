import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function safeParseParsedItems(json: string): unknown[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function PATCH(request: Request, context: RouteContext) {
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

    const { id } = await context.params;

    // Verify the cash log exists and belongs to the user's workspace
    const existingLogs = await databases.listDocuments(
      config.databaseId,
      "cash_logs",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingLogs.documents.length === 0) {
      return NextResponse.json(
        { detail: "Cash log not found or access denied." },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      text?: string;
      date?: string;
      isIncome?: boolean;
      status?: string;
      parsedItems?: unknown[];
    };

    const updates: Record<string, unknown> = {};

    if (body.text !== undefined) {
      updates.text = body.text.trim();
    }

    if (body.date !== undefined) {
      updates.date = body.date;
      // Extract YYYY-MM directly from YYYY-MM-DD to avoid timezone issues
      updates.month = body.date.substring(0, 7);
    }

    if (body.isIncome !== undefined) {
      updates.isIncome = body.isIncome;
    }

    if (body.status !== undefined) {
      updates.status = body.status;
    }

    if (body.parsedItems !== undefined) {
      updates.parsed_items = JSON.stringify(body.parsedItems);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { detail: "No updates provided." },
        { status: 400 }
      );
    }

    const doc = await databases.updateDocument(
      config.databaseId,
      "cash_logs",
      id,
      updates
    );

    return NextResponse.json({
      id: doc.$id,
      text: doc.text ?? "",
      date: doc.date ?? "",
      month: doc.month ?? "",
      status: doc.status ?? "draft",
      source: doc.source ?? "text",
      isIncome: doc.isIncome ?? false,
      parsedItems: doc.parsed_items ? safeParseParsedItems(doc.parsed_items) : null,
      createdAt: doc.$createdAt
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error("Failed to update cash log:", error);
    return NextResponse.json(
      { detail: "Failed to update cash log." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check delete permission
    await requireWorkspacePermission(workspaceId, user.$id, 'delete');

    const { id } = await context.params;

    // Verify the cash log exists and belongs to the user's workspace
    const existingLogs = await databases.listDocuments(
      config.databaseId,
      "cash_logs",
      [Query.equal("$id", id), Query.equal("workspace_id", workspaceId), Query.limit(1)]
    );

    if (existingLogs.documents.length === 0) {
      return NextResponse.json(
        { detail: "Cash log not found or access denied." },
        { status: 404 }
      );
    }

    await databases.deleteDocument(
      config.databaseId,
      "cash_logs",
      id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error("Failed to delete cash log:", error);
    return NextResponse.json(
      { detail: "Failed to delete cash log." },
      { status: 500 }
    );
  }
}
