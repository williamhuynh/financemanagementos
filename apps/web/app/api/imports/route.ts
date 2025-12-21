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
    file_name: body.fileName ?? "",
    row_count: rows.length,
    status: "imported",
    uploaded_at: new Date().toISOString()
  };

  await databases.createDocument(databaseId, "imports", importId, importDoc);

  const createdTransactions: CategorizationInput[] = [];

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
      const suggestions = await fetchCategorySuggestions(
        createdTransactions,
        categories,
        openRouterKey,
        openRouterModel
      );
      const suggestionMap = new Map(
        suggestions
          .filter((item) => typeof item?.id === "string")
          .map((item) => [item.id, item.category ?? "Unknown"])
      );

      for (const transaction of createdTransactions) {
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
    } catch (error) {
      console.error("Auto-categorization failed:", error);
    }
  }

  return NextResponse.json({ importId });
}
