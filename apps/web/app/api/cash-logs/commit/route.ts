import { NextResponse } from "next/server";
import { ID } from "node-appwrite";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";

export const dynamic = "force-dynamic";

const CASH_ACCOUNT_NAME = "Cash";

type ParsedItem = {
  description: string;
  amount: number;
  category: string;
  confidence?: number;
};

type ProcessedGroup = {
  logId: string;
  items: ParsedItem[];
};

type CommitInput = {
  processed: ProcessedGroup[];
};

function isIncomeCategory(category: string): boolean {
  const lower = category.toLowerCase();
  return lower.includes("income");
}

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

    // Check admin permission (committing cash logs is an admin operation)
    await requireWorkspacePermission(workspaceId, user.$id, 'admin');
    const body = (await request.json()) as CommitInput;

    if (!body.processed || body.processed.length === 0) {
      return NextResponse.json(
        { detail: "No processed items provided." },
        { status: 400 }
      );
    }

    const createdTransactions: string[] = [];
    const updatedLogs: string[] = [];

    for (const group of body.processed) {
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
        const isIncome = logIsIncome || isIncomeCategory(item.category);
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
          currency: "AUD",
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
