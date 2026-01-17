import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CashLogInput = {
  text: string;
  date?: string;
  isIncome?: boolean;
};

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
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  try {
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

    const logs = response.documents.map((doc) => ({
      id: doc.$id,
      text: doc.text ?? "",
      date: doc.date ?? "",
      month: doc.month ?? "",
      status: doc.status ?? "draft",
      source: doc.source ?? "text",
      isIncome: doc.isIncome ?? false,
      parsedItems: doc.parsed_items ? safeParseParsedItems(doc.parsed_items) : null,
      createdAt: doc.$createdAt
    }));

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Failed to fetch cash logs:", error);
    return NextResponse.json(
      { detail: "Failed to fetch cash logs." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const ctx = await getApiContext();
  if (!ctx) {
    return NextResponse.json(
      { detail: "Unauthorized or missing configuration." },
      { status: 401 }
    );
  }

  const { databases, config, workspaceId } = ctx;

  try {
    const body = (await request.json()) as CashLogInput;

    if (!body.text?.trim()) {
      return NextResponse.json(
        { detail: "Text is required." },
        { status: 400 }
      );
    }

    const date = body.date || new Date().toISOString().split("T")[0];
    const month = getMonthKey(date);

    const logId = ID.unique();
    const logDoc = {
      workspace_id: workspaceId,
      text: body.text.trim(),
      date,
      month,
      status: "draft",
      source: "text",
      isIncome: body.isIncome ?? false,
      parsed_items: "[]"
    };

    const created = await databases.createDocument(
      config.databaseId,
      "cash_logs",
      logId,
      logDoc
    );

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
    console.error("Failed to create cash log:", error);
    return NextResponse.json(
      { detail: "Failed to create cash log." },
      { status: 500 }
    );
  }
}
