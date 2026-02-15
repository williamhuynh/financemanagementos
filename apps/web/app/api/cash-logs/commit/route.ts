import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../../lib/workspace-service";
import { isIncomeCategory, getCategoriesWithMeta } from "../../../../lib/data";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, CashLogCommitSchema } from "../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

const CASH_ACCOUNT_NAME = "Cash";

export async function POST(request: Request) {
  const blocked = rateLimit(request, DATA_RATE_LIMITS.bulk);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check admin permission (committing cash logs is an admin operation)
    await requireWorkspacePermission(workspaceId, user.$id, 'admin');
    const body = await request.json();

    const parsed = validateBody(CashLogCommitSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { processed: processedGroups } = parsed.data;

    const createdTransactions: string[] = [];
    const updatedLogs: string[] = [];
    const workspace = await getWorkspaceById(workspaceId);
    const workspaceCurrency = workspace?.currency ?? "AUD";
    const workspaceCategories = await getCategoriesWithMeta(workspaceId);

    for (const group of processedGroups) {
      // Fetch the original log to get the date
      let logDate: string;
      let logIsIncome = false;

      try {
        const logDoc = await databases.getDocument(
          config.databaseId,
          "cash_logs",
          group.logId
        );
        logDate = String(logDoc.date ?? new Date().toISOString().split("T")[0]);
        logIsIncome = Boolean(logDoc.isIncome);
      } catch {
        // If log doesn't exist, use today's date
        logDate = new Date().toISOString().split("T")[0];
      }

      // Create transactions for each parsed item
      for (const item of group.items) {
        const isIncome = logIsIncome || isIncomeCategory(item.category, workspaceCategories);
        const direction = isIncome ? "credit" : "debit";
        const amount = isIncome
          ? item.amount.toFixed(2)
          : `-${item.amount.toFixed(2)}`;

        const transactionId = ID.unique();
        const transactionDoc = {
          workspace_id: workspaceId,
          import_id: "",
          date: logDate,
          description: item.description,
          amount,
          currency: workspaceCurrency,
          account_name: CASH_ACCOUNT_NAME,
          source_account: CASH_ACCOUNT_NAME,
          category_name: item.category,
          direction,
          notes: `From cash log: ${group.logId}`,
          is_transfer: false,
          needs_review: false
        };

        try {
          await databases.createDocument(
            config.databaseId,
            "transactions",
            transactionId,
            transactionDoc
          );
          createdTransactions.push(transactionId);
        } catch (error) {
          console.error("Failed to create transaction:", error);
        }
      }

      // Update the log status to committed
      try {
        await databases.updateDocument(
          config.databaseId,
          "cash_logs",
          group.logId,
          { status: "committed" }
        );
        updatedLogs.push(group.logId);
      } catch (error) {
        console.error(`Failed to update log ${group.logId}:`, error);
      }
    }

    // Audit: fire-and-forget
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "commit",
      resource_type: "cash_log",
      resource_id: updatedLogs.join(","),
      summary: `Committed ${updatedLogs.length} cash log(s), created ${createdTransactions.length} transaction(s)`,
      metadata: { logsCommitted: updatedLogs, transactionsCreated: createdTransactions.length },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({
      success: true,
      transactionsCreated: createdTransactions.length,
      logsCommitted: updatedLogs.length
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
    console.error("Failed to commit cash logs:", error);
    return NextResponse.json(
      { detail: "Failed to commit cash logs." },
      { status: 500 }
    );
  }
}
