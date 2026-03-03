import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, TransactionCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";
import { COLLECTIONS } from "../../../lib/collection-names";

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.write);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { databases, config, workspaceId, user } = ctx;

    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const body = await request.json();
    const parsed = validateBody(TransactionCreateSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const { date, amount, account_name, category_name, description, currency, notes } = parsed.data;

    // Fetch workspace to get default currency
    const workspace = await databases.getDocument(
      config.databaseId,
      COLLECTIONS.WORKSPACES,
      workspaceId
    );
    const defaultCurrency = workspace.currency || "AUD";

    // Derive direction from amount (credit = positive income, debit = negative expense)
    const direction = amount < 0 ? "debit" : "credit";

    // Normalize category
    const normalizedCategory = category_name?.trim() || "Uncategorised";

    // Set flags
    const needs_review = normalizedCategory === "Uncategorised";
    const is_transfer = normalizedCategory === "Transfer";

    // Generate transaction ID
    const transactionId = ID.unique();

    // Create transaction document matching Appwrite schema
    const transactionDoc = {
      workspace_id: workspaceId,
      import_id: `manual-${transactionId}`,  // Required by schema
      date,
      description: description || "",  // Required by schema, default to empty string
      amount: amount.toString(),  // Schema expects string
      account_name,
      category_name: normalizedCategory,
      currency: currency || defaultCurrency,
      direction,
      is_transfer,
      needs_review,
      ...(notes && { notes }),
    };

    const doc = await databases.createDocument(
      config.databaseId,
      COLLECTIONS.TRANSACTIONS,
      transactionId,
      transactionDoc
    );

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "create",
      resource_type: "transaction",
      resource_id: doc.$id,
      summary: `Created manual transaction ${doc.$id}`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ ok: true, id: doc.$id }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json({ error: "Access denied" }, { status: 403 });
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
      }
    }
    console.error("Transaction POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
