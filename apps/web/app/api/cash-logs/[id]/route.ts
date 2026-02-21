import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, CashLogUpdateSchema } from "../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

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
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
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
        { error: "Cash log not found or access denied." },
        { status: 404 }
      );
    }

    const body = await request.json();

    const parsed = validateBody(CashLogUpdateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { text, date, isIncome, status, parsedItems } = parsed.data;

    const updates: Record<string, unknown> = {};

    if (text !== undefined) {
      updates.text = text.trim();
    }

    if (date !== undefined) {
      updates.date = date;
      // Extract YYYY-MM directly from YYYY-MM-DD to avoid timezone issues
      updates.month = date.substring(0, 7);
    }

    if (isIncome !== undefined) {
      updates.isIncome = isIncome;
    }

    if (status !== undefined) {
      updates.status = status;
    }

    if (parsedItems !== undefined) {
      updates.parsed_items = JSON.stringify(parsedItems);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided." },
        { status: 400 }
      );
    }

    const doc = await databases.updateDocument(
      config.databaseId,
      "cash_logs",
      id,
      updates
    );

    // Audit: fire-and-forget
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "update",
      resource_type: "cash_log",
      resource_id: id,
      summary: `Updated cash log (fields: ${Object.keys(updates).join(", ")})`,
      ip_address: getClientIp(request),
    });

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
      { error: "Failed to update cash log." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.delete);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
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
        { error: "Cash log not found or access denied." },
        { status: 404 }
      );
    }

    await databases.deleteDocument(
      config.databaseId,
      "cash_logs",
      id
    );

    // Audit: fire-and-forget
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "delete",
      resource_type: "cash_log",
      resource_id: id,
      summary: `Deleted cash log`,
      ip_address: getClientIp(request),
    });

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
      { error: "Failed to delete cash log." },
      { status: 500 }
    );
  }
}
