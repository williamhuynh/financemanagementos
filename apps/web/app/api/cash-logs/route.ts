import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, CashLogCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

type AppwriteDocument = { $id: string; $createdAt: string; [key: string]: unknown };

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getMonthKey(dateString: string) {
  // Extract YYYY-MM directly from YYYY-MM-DD to avoid timezone issues
  return dateString.substring(0, 7);
}

function safeParseParsedItems(json: string): unknown[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.read);
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

    // Check read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");
    const status = searchParams.get("status");
    const queries = [
      Query.equal("workspace_id", workspaceId),
      Query.orderDesc("date"),
      Query.orderDesc("$createdAt"),
      Query.limit(100)
    ];

    if (month) {
      queries.push(Query.equal("month", month));
    }

    if (status) {
      queries.push(Query.equal("status", status));
    }

    const response = await databases.listDocuments(
      config.databaseId,
      "cash_logs",
      queries
    );

    const logs = response.documents.map((doc: AppwriteDocument) => ({
      id: doc.$id,
      text: doc.text ?? "",
      date: doc.date ?? "",
      month: doc.month ?? "",
      status: doc.status ?? "draft",
      source: doc.source ?? "text",
      isIncome: doc.isIncome ?? false,
      parsedItems: doc.parsed_items ? safeParseParsedItems(String(doc.parsed_items)) : null,
      createdAt: doc.$createdAt
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error("Failed to fetch cash logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch cash logs." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.write);
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
    const body = await request.json();

    const parsed = validateBody(CashLogCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { text, date: inputDate, isIncome } = parsed.data;

    const date = inputDate || new Date().toISOString().split("T")[0];
    const month = getMonthKey(date);

    const logId = ID.unique();
    const logDoc = {
      workspace_id: workspaceId,
      text,
      date,
      month,
      status: "draft",
      source: "text",
      isIncome: isIncome ?? false,
      parsed_items: "[]"
    };

    const created = await databases.createDocument(
      config.databaseId,
      "cash_logs",
      logId,
      logDoc
    );

    // Audit: fire-and-forget
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "cash_log",
      resource_id: logId,
      summary: `Created cash log "${text.substring(0, 50)}"`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      id: logId,
      text: logDoc.text,
      date: logDoc.date,
      month: logDoc.month,
      status: logDoc.status,
      source: logDoc.source,
      isIncome: logDoc.isIncome,
      parsedItems: null,
      createdAt: created.$createdAt
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
    console.error("Failed to create cash log:", error);
    return NextResponse.json(
      { error: "Failed to create cash log." },
      { status: 500 }
    );
  }
}
