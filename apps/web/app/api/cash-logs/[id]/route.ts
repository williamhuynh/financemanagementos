import { NextResponse } from "next/server";
import { getServerAppwrite } from "../../../../lib/appwrite-server";

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
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const { id } = await context.params;

  try {
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

    const doc = await serverClient.databases.updateDocument(
      serverClient.databaseId,
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
    console.error("Failed to update cash log:", error);
    return NextResponse.json(
      { detail: "Failed to update cash log." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const { id } = await context.params;

  try {
    await serverClient.databases.deleteDocument(
      serverClient.databaseId,
      "cash_logs",
      id
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete cash log:", error);
    return NextResponse.json(
      { detail: "Failed to delete cash log." },
      { status: 500 }
    );
  }
}
