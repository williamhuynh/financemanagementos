import { NextResponse } from "next/server";
import { Client, Databases, Query } from "node-appwrite";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_WORKSPACE_ID = "default";
const DEFAULT_CATEGORIES = [
  "Income - Primary",
  "Income - Secondary",
  "Housing",
  "Transportation",
  "Groceries",
  "Food",
  "Utilities",
  "Medical, Healthcare & Fitness",
  "Savings, Investing, & Debt Payments",
  "Personal Spending",
  "Recreation & Entertainment",
  "Travel & Holidays",
  "Miscellaneous",
  "Work Expenses - Primary",
  "Work Expenses - Secondary",
  "Finance",
  "Parents Expenses",
  "Mortgage Repayments",
  "Transfer",
  "Uncategorised"
];

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

export async function GET() {
  const serverClient = getServerAppwrite();

  if (!serverClient) {
    return NextResponse.json({ categories: DEFAULT_CATEGORIES });
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "categories",
      [Query.equal("workspace_id", DEFAULT_WORKSPACE_ID), Query.orderAsc("name")]
    );

    const names = (response?.documents ?? [])
      .map((doc) => String(doc.name ?? "").trim())
      .filter(Boolean);

    const categories = names.length > 0 ? names : DEFAULT_CATEGORIES;

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ categories: DEFAULT_CATEGORIES });
  }
}
