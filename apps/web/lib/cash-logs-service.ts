import { Query, Databases } from "node-appwrite";
import { getServerConfig, createDatabasesClient } from "./api-auth";
import { COLLECTIONS } from "./collection-names";

export type ParsedItem = {
  description: string;
  amount: number;
  category: string;
  confidence?: number;
};

export type CashLog = {
  id: string;
  text: string;
  date: string;
  month: string;
  status: "draft" | "processed" | "committed";
  source: "text" | "voice";
  isIncome: boolean;
  parsedItems: ParsedItem[] | null;
  createdAt: string;
};

export type Category = string;

function safeParseParsedItems(json: string): ParsedItem[] | null {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Fetches cash logs from the database
 * @param workspaceId The workspace ID to filter by
 * @param month Optional month filter in YYYY-MM format
 * @param status Optional status filter
 * @returns Array of cash logs
 */
export async function fetchCashLogs(
  workspaceId: string,
  month?: string,
  status?: string
): Promise<CashLog[]> {
  const config = getServerConfig();
  if (!config) {
    console.error("[CASH-LOGS-SERVICE] Missing Appwrite server configuration");
    return [];
  }

  const databases = createDatabasesClient(config);

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

    console.log("[CASH-LOGS-SERVICE] Querying with filters:", { month, status, workspaceId });

    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.CASH_LOGS,
      queries
    );

    console.log("[CASH-LOGS-SERVICE] Found", response.documents.length, "documents");

    const logs = response.documents.map((doc) => ({
      id: doc.$id,
      text: doc.text ?? "",
      date: doc.date ?? "",
      month: doc.month ?? "",
      status: (doc.status ?? "draft") as "draft" | "processed" | "committed",
      source: (doc.source ?? "text") as "text" | "voice",
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
 * @param workspaceId The workspace ID to filter by
 * @returns Array of category names
 */
export async function fetchCategories(workspaceId: string): Promise<Category[]> {
  const config = getServerConfig();

  if (!config) {
    console.log("[CASH-LOGS-SERVICE] No Appwrite client, returning default categories");
    return DEFAULT_CATEGORIES;
  }

  const databases = createDatabasesClient(config);

  try {
    const response = await databases.listDocuments(
      config.databaseId,
      COLLECTIONS.CATEGORIES,
      [Query.equal("workspace_id", workspaceId), Query.orderAsc("name")]
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
