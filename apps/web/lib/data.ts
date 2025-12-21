import type { NavItem } from "./mockData";
import {
  assetCards,
  ledgerRows,
  navItems,
  reportStats,
  reviewItems,
  statCards
} from "./mockData";
import { getAppwriteClient } from "./appwriteClient";
import { Client, Databases, Query } from "node-appwrite";

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
  "Miscellaneous",
  "Work Expenses - Primary",
  "Work Expenses - Secondary",
  "Finance",
  "Parents Expenses",
  "Mortgage Repayments",
  "Uncategorised"
];

type CardStat = {
  title: string;
  value: string;
  sub: string;
  tone?: string;
};

export type LedgerRow = {
  id: string;
  title: string;
  sub: string;
  category: string;
  amount: string;
  tone: string;
  chip?: string;
  highlight?: boolean;
};

export type ReviewItem = {
  id: string;
  title: string;
  sub: string;
  amount: string;
  category: string;
  actions: string[];
};

type AssetCard = {
  title: string;
  value: string;
  sub: string;
};

type ReportStat = {
  title: string;
  value: string;
  sub: string;
};

async function listOrFallback<T>(collectionId: string, fallback: T[]) {
  const client = getAppwriteClient();

  if (!client) {
    return fallback;
  }

  try {
    const response = await client.databases.listDocuments(client.databaseId, collectionId);
    const documents = response?.documents ?? [];

    if (documents.length === 0) {
      return fallback;
    }

    return documents as T[];
  } catch (error) {
    return fallback;
  }
}

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

function formatAmount(value: string, currency = "AUD") {
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(numeric);
}

function formatDirectionLabel(direction?: string, amount?: string) {
  if (direction) {
    return direction === "credit" ? "Credit" : "Debit";
  }
  if (amount?.startsWith("-")) {
    return "Debit";
  }
  if (amount) {
    return "Credit";
  }
  return "Transaction";
}

export async function getNavItems(): Promise<NavItem[]> {
  return navItems;
}

export async function getCategories(): Promise<string[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
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
    return names.length ? names : DEFAULT_CATEGORIES;
  } catch (error) {
    return DEFAULT_CATEGORIES;
  }
}

export async function getStatCards(): Promise<CardStat[]> {
  return listOrFallback<CardStat>("dashboard_cards", statCards);
}

export async function getLedgerRows(): Promise<LedgerRow[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return listOrFallback<LedgerRow>("ledger_rows", ledgerRows);
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("$createdAt"),
        Query.limit(50)
      ]
    );
    const documents = response?.documents ?? [];

    if (documents.length === 0) {
      return ledgerRows;
    }

    return documents.map((doc) => {
      const amount = String(doc.amount ?? "");
      const direction = String(doc.direction ?? "");
      const formattedAmount = formatAmount(
        amount,
        String(doc.currency ?? "AUD")
      );
      const category = String(doc.category_name ?? "Uncategorised");
      const needsReview = Boolean(doc.needs_review) || category === "Uncategorised";
      const tone =
        direction === "credit" || (!amount.startsWith("-") && amount !== "")
          ? "positive"
          : "negative";
      const label = formatDirectionLabel(direction, amount);
      const account = String(doc.account_name ?? "Unassigned");
      const date = String(doc.date ?? "");

      return {
        id: String(doc.$id ?? ""),
        title: String(doc.description ?? "Transaction"),
        sub: [date, label, account].filter(Boolean).join(" - "),
        category,
        amount: formattedAmount,
        tone,
        chip: needsReview ? "warn" : undefined,
        highlight: needsReview
      };
    });
  } catch (error) {
    return ledgerRows;
  }
}

export async function getReviewItems(): Promise<ReviewItem[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return listOrFallback<ReviewItem>("review_items", reviewItems);
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.or([
          Query.equal("needs_review", true),
          Query.equal("category_name", "Uncategorised")
        ]),
        Query.orderDesc("$createdAt"),
        Query.limit(12)
      ]
    );
    const documents = response?.documents ?? [];

    if (documents.length === 0) {
      return reviewItems;
    }

    return documents.map((doc) => {
      const amount = formatAmount(
        String(doc.amount ?? ""),
        String(doc.currency ?? "AUD")
      );
      const date = String(doc.date ?? "");
      const account = String(doc.account_name ?? "Unassigned");
      return {
        id: String(doc.$id ?? ""),
        title: String(doc.description ?? "Transaction"),
        sub: [date, account].filter(Boolean).join(" - "),
        amount,
        category: String(doc.category_name ?? "Uncategorised"),
        actions: ["Assign category", "Mark transfer", "Split"]
      };
    });
  } catch (error) {
    return reviewItems;
  }
}

export async function getAssetCards(): Promise<AssetCard[]> {
  return listOrFallback<AssetCard>("asset_cards", assetCards);
}

export async function getReportStats(): Promise<ReportStat[]> {
  return listOrFallback<ReportStat>("report_stats", reportStats);
}
