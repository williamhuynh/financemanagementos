import { NextResponse } from "next/server";
import { Client, Databases, ID } from "node-appwrite";

export const dynamic = "force-dynamic";

const DEFAULT_WORKSPACE_ID = "default";
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

function getServerAppwrite() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return null;
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId };
}

function isIncomeCategory(category: string): boolean {
  const lower = category.toLowerCase();
  return lower.includes("income");
}

export async function POST(request: Request) {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  try {
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
        const logDoc = await serverClient.databases.getDocument(
          serverClient.databaseId,
          "cash_logs",
          group.logId
        );
        logDate = String(logDoc.date ?? new Date().toISOString().split("T")[0]);
        logIsIncome = Boolean(logDoc.is_income);
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
          workspace_id: DEFAULT_WORKSPACE_ID,
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
          await serverClient.databases.createDocument(
            serverClient.databaseId,
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
        await serverClient.databases.updateDocument(
          serverClient.databaseId,
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
    console.error("Failed to commit cash logs:", error);
    return NextResponse.json(
      { detail: "Failed to commit cash logs." },
      { status: 500 }
    );
  }
}
