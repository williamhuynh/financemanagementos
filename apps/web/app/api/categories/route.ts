import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";

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
  try {
    const ctx = await getApiContext();

    // Fall back to default categories if not authenticated
    if (!ctx) {
      return NextResponse.json({ categories: DEFAULT_CATEGORIES });
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

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
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    // Fall back to default categories on error
    return NextResponse.json({ categories: DEFAULT_CATEGORIES });
  }
}
