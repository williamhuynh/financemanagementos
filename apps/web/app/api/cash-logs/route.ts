import { NextResponse } from "next/server";
import { ID, Query } from "node-appwrite";
import { getServerAppwrite, DEFAULT_WORKSPACE_ID } from "../../../lib/appwrite-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type CashLogInput = {
  text: string;
  date?: string;
  isIncome?: boolean;
};

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
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
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  const status = searchParams.get("status");

  try {
    const queries = [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
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

    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
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
      isIncome: doc.is_income ?? false,
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
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  try {
    const body = (await request.json()) as CashLogInput;

    if (!body.text?.trim()) {
      return NextResponse.json(
        { detail: "Text is required." },
        { status: 400 }
      );
    }

    const date = body.date || new Date().toISOString().split("T")[0];
    const parsedDate = new Date(date);
    const month = getMonthKey(parsedDate);

    const logId = ID.unique();
    const logDoc = {
      workspace_id: DEFAULT_WORKSPACE_ID,
      text: body.text.trim(),
      date,
      month,
      status: "draft",
      source: "text",
      is_income: body.isIncome ?? false,
      parsed_items: null,
      created_at: new Date().toISOString()
    };

    await serverClient.databases.createDocument(
      serverClient.databaseId,
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
      isIncome: logDoc.is_income,
      parsedItems: null,
      createdAt: logDoc.created_at
    });
  } catch (error) {
    console.error("Failed to create cash log:", error);
    return NextResponse.json(
      { detail: "Failed to create cash log." },
      { status: 500 }
    );
  }
}
