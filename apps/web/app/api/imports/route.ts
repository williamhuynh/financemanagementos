import { NextResponse } from "next/server";
import { Client, Databases, ID, Query } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
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

type ImportRow = {
  date?: string;
  description?: string;
  amount?: string;
  account?: string;
  category?: string;
  currency?: string;
};

type CategorizationInput = {
  id: string;
  date: string;
  description: string;
  amount: string;
  account: string;
};

type CategorySuggestion = {
  id: string;
  category: string;
  confidence?: number;
};

type HistoryTransaction = {
  id: string;
  date: string;
  description: string;
  amount: string;
  category: string;
};

type HistoryMatch = {
  id: string;
  match_id: string | null;
  confidence?: number;
};

async function loadWorkspaceCategories(
  databases: Databases,
  databaseId: string
): Promise<string[]> {
  try {
    const response = await databases.listDocuments(databaseId, "categories", [
      Query.equal("workspace_id", DEFAULT_WORKSPACE_ID)
    ]);
    const names = response.documents
      .map((doc) => String(doc.name ?? "").trim())
      .filter(Boolean);
    return names.length ? names : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
}

function normalizeCategory(
  value: string,
  allowedCategories: string[]
): string {
  const trimmed = value.trim();
  if (!trimmed) return "Uncategorised";
  const lookup = new Map(
    allowedCategories.map((category) => [category.toLowerCase(), category])
  );
  return lookup.get(trimmed.toLowerCase()) ?? "Uncategorised";
}

function extractJsonArray(text: string): CategorySuggestion[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function extractHistoryMatches(text: string): HistoryMatch[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getReferenceDate(rows: ImportRow[]): Date | null {
  let latest: Date | null = null;
  for (const row of rows) {
    const parsed = parseDate(row.date);
    if (!parsed) continue;
    if (!latest || parsed.getTime() > latest.getTime()) {
      latest = parsed;
    }
  }
  return latest;
}

function getPreviousMonthRange(reference: Date): { start: Date; end: Date } {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

async function fetchCategorySuggestions(
  transactions: CategorizationInput[],
  categories: string[],
  apiKey: string,
  model: string
): Promise<CategorySuggestion[]> {
  const systemPrompt = [
    "You are a finance categorization assistant.",
    "Choose exactly one category from the provided list for each transaction.",
    "If you are unsure, respond with \"Uncategorised\".",
    "Return ONLY a JSON array of objects: [{\"id\":\"...\",\"category\":\"...\",\"confidence\":0.0}]."
  ].join(" ");

  const userPrompt = [
    "Allowed categories:",
    categories.join(", "),
    "",
    "Transactions:",
    JSON.stringify(transactions, null, 2)
  ].join("\n");

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Finance Mgmt Tool"
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return extractJsonArray(content) ?? [];
}

async function fetchHistoryMatches(
  incoming: CategorizationInput[],
  history: HistoryTransaction[],
  apiKey: string,
  model: string
): Promise<HistoryMatch[]> {
  const systemPrompt = [
    "You match incoming transactions to very similar transactions from last month.",
    "Use description and amount as primary signals.",
    "Only return a match when you are highly confident they represent the same merchant/transaction type.",
    "If unsure, return match_id as null with low confidence.",
    "Return ONLY a JSON array: [{\"id\":\"...\",\"match_id\":\"...\"|null,\"confidence\":0.0}]."
  ].join(" ");

  const userPrompt = [
    "History (last month):",
    JSON.stringify(history, null, 2),
    "",
    "Incoming:",
    JSON.stringify(incoming, null, 2)
  ].join("\n");

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3000",
      "X-Title": "Finance Mgmt Tool"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  return extractHistoryMatches(content) ?? [];
}

export async function POST(request: Request) {
  const endpoint = process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId = process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel =
    process.env.OPENROUTER_MODEL ?? "xiaomi/mimo-v2-flash:free";

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const body = (await request.json()) as {
    sourceName?: string;
    fileName?: string;
    rows?: ImportRow[];
    sourceAccount?: string;
    sourceOwner?: string;
  };

  const rows = body.rows ?? [];
  if (!rows.length) {
    return NextResponse.json({ detail: "No rows provided." }, { status: 400 });
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const importId = ID.unique();
  const importDoc = {
    workspace_id: DEFAULT_WORKSPACE_ID,
    source_name: body.sourceName ?? "CSV",
    source_account: body.sourceAccount ?? "",
    source_owner: body.sourceOwner ?? "",
    file_name: body.fileName ?? "",
    row_count: rows.length,
    status: "imported",
    uploaded_at: new Date().toISOString()
  };

  await databases.createDocument(databaseId, "imports", importId, importDoc);

  const createdTransactions: CategorizationInput[] = [];

  const sourceAccount = body.sourceAccount ?? "";
  const referenceDate = getReferenceDate(rows);

  for (const row of rows) {
    const amount = row.amount ?? "";
    const direction = amount.startsWith("-") ? "debit" : "credit";
    const rawCategory = row.category?.trim() ?? "";
    const category =
      !rawCategory || rawCategory.toLowerCase() === "unknown"
        ? "Uncategorised"
        : rawCategory;
    const transactionId = ID.unique();
    const transactionDoc = {
      workspace_id: DEFAULT_WORKSPACE_ID,
      import_id: importId,
      date: row.date ?? "",
      description: row.description ?? "",
      amount,
      currency: row.currency ?? "AUD",
      account_name: row.account ?? body.sourceAccount ?? "Unassigned",
      source_account: body.sourceAccount ?? "",
      source_owner: body.sourceOwner ?? "",
      category_name: category,
      direction,
      notes: "",
      is_transfer: false,
      needs_review: category === "Uncategorised"
    };

    await databases.createDocument(
      databaseId,
      "transactions",
      transactionId,
      transactionDoc
    );

    createdTransactions.push({
      id: transactionId,
      date: row.date ?? "",
      description: row.description ?? "",
      amount,
      account: row.account ?? body.sourceAccount ?? "Unassigned"
    });
  }

  const shouldAutoCategorize = rows.every((row) => {
    const rawCategory = row.category?.trim();
    if (!rawCategory) return true;
    const normalized = rawCategory.toLowerCase();
    return normalized === "unknown" || normalized === "uncategorised";
  });

  if (shouldAutoCategorize && openRouterKey) {
    try {
      const categories = await loadWorkspaceCategories(databases, databaseId);
      const categorizedIds = new Set<string>();
      let remainingTransactions = createdTransactions;

      if (referenceDate && sourceAccount) {
        const range = getPreviousMonthRange(referenceDate);
        const historyResponse = await databases.listDocuments(
          databaseId,
          "transactions",
          [
            Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
            Query.equal("source_account", sourceAccount),
            Query.orderDesc("date"),
            Query.limit(400)
          ]
        );
        const history = historyResponse.documents
          .map((doc) => ({
            id: doc.$id,
            date: String(doc.date ?? ""),
            description: String(doc.description ?? ""),
            amount: String(doc.amount ?? ""),
            category: String(doc.category_name ?? "Uncategorised")
          }))
          .filter((doc) => doc.category !== "Uncategorised")
          .filter((doc) => {
            const parsed = parseDate(doc.date);
            if (!parsed) return false;
            return parsed >= range.start && parsed <= range.end;
          });

        if (history.length) {
          const matches = await fetchHistoryMatches(
            createdTransactions,
            history,
            openRouterKey,
            openRouterModel
          );
          const historyMap = new Map(history.map((item) => [item.id, item]));
          for (const match of matches) {
            if (!match?.id || !match.match_id) continue;
            if ((match.confidence ?? 0) < 0.8) continue;
            const matched = historyMap.get(match.match_id);
            if (!matched) continue;
            const normalizedCategory = normalizeCategory(
              matched.category,
              categories
            );
            if (normalizedCategory === "Uncategorised") continue;
            await databases.updateDocument(
              databaseId,
              "transactions",
              match.id,
              {
                category_name: normalizedCategory,
                needs_review: false
              }
            );
            categorizedIds.add(match.id);
          }
        }
      }

      if (categorizedIds.size) {
        remainingTransactions = createdTransactions.filter(
          (txn) => !categorizedIds.has(txn.id)
        );
      }

      if (remainingTransactions.length) {
        const suggestions = await fetchCategorySuggestions(
          remainingTransactions,
          categories,
          openRouterKey,
          openRouterModel
        );
        const suggestionMap = new Map(
          suggestions
            .filter((item) => typeof item?.id === "string")
            .map((item) => [item.id, item.category ?? "Unknown"])
        );

        for (const transaction of remainingTransactions) {
          const suggestedCategory = suggestionMap.get(transaction.id);
          if (!suggestedCategory) continue;
          const normalizedCategory = normalizeCategory(
            suggestedCategory,
            categories
          );
          if (normalizedCategory === "Uncategorised") {
            continue;
          }
          await databases.updateDocument(
            databaseId,
            "transactions",
            transaction.id,
            {
              category_name: normalizedCategory,
              needs_review: normalizedCategory === "Uncategorised"
            }
          );
        }
      }
    } catch (error) {
      console.error("Auto-categorization failed:", error);
    }
  }

  return NextResponse.json({ importId });
}

export async function GET() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return NextResponse.json(
      { detail: "Missing Appwrite server configuration." },
      { status: 500 }
    );
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  const databases = new Databases(client);

  const response = await databases.listDocuments(databaseId, "imports", [
    Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
    Query.orderDesc("uploaded_at"),
    Query.limit(30)
  ]);

  const imports = response.documents.map((doc) => ({
    id: doc.$id,
    source_name: doc.source_name,
    source_owner: doc.source_owner,
    file_name: doc.file_name,
    row_count: doc.row_count,
    status: doc.status,
    uploaded_at: doc.uploaded_at
  }));

  return NextResponse.json({ imports });
}
