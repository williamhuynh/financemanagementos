import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export async function GET() {
  const ctx = await getApiContext();

  // Fall back to default categories if not authenticated
  if (!ctx) {
    return NextResponse.json({ categories: DEFAULT_CATEGORIES });
  }

  const { databases, config, workspaceId } = ctx;

  try {
    const response = await databases.listDocuments(
      config.databaseId,
      "categories",
      [Query.equal("workspace_id", workspaceId), Query.orderAsc("name")]
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
