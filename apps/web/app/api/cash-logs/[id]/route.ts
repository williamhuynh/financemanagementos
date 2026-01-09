import { NextResponse } from "next/server";
import { Client, Databases } from "node-appwrite";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
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
      const parsedDate = new Date(body.date);
      const year = parsedDate.getFullYear();
      const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
      updates.month = `${year}-${month}`;
    }

    if (body.isIncome !== undefined) {
      updates.is_income = body.isIncome;
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
      isIncome: doc.is_income ?? false,
      parsedItems: doc.parsed_items ? JSON.parse(doc.parsed_items) : null,
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

export async function DELETE(request: Request, context: RouteContext) {
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
