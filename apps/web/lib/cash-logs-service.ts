import { Query } from "node-appwrite";
import { getServerAppwrite, DEFAULT_WORKSPACE_ID } from "./appwrite-server";

export type CashLog = {
  id: string;
  text: string;
  date: string;
  month: string;
  status: string;
  source: string;
  isIncome: boolean;
  parsedItems: unknown[] | null;
  createdAt: string;
};

export type Category = string;

function safeParseParsedItems(json: string): unknown[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Fetches cash logs from the database
 * @param month Optional month filter in YYYY-MM format
 * @param status Optional status filter
 * @returns Array of cash logs
 */
export async function fetchCashLogs(
  month?: string,
  status?: string
): Promise<CashLog[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    console.error("[CASH-LOGS-SERVICE] Missing Appwrite server configuration");
    return [];
  }

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

    console.log("[CASH-LOGS-SERVICE] Querying with filters:", { month, status });

    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "cash_logs",
      queries
    );

    console.log("[CASH-LOGS-SERVICE] Found", response.documents.length, "documents");

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

    return logs;
  } catch (error) {
    console.error("[CASH-LOGS-SERVICE] Failed to fetch cash logs:", error);
    return [];
  }
}

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

/**
 * Fetches categories from the database
 * @returns Array of category names
 */
export async function fetchCategories(): Promise<Category[]> {
  const serverClient = getServerAppwrite();

  if (!serverClient) {
    console.log("[CASH-LOGS-SERVICE] No Appwrite client, returning default categories");
    return DEFAULT_CATEGORIES;
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

    console.log("[CASH-LOGS-SERVICE] Fetched", categories.length, "categories");
    return categories;
  } catch (error) {
    console.error("[CASH-LOGS-SERVICE] Failed to fetch categories:", error);
    return DEFAULT_CATEGORIES;
  }
}
