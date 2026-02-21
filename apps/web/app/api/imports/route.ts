import { NextResponse, after } from "next/server";
import { Databases, ID, Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { getWorkspaceById } from "../../../lib/workspace-service";
import { normalizeDateToISO } from "../../../lib/data";
import { DEFAULT_CATEGORY_NAMES } from "../../../lib/categories";
import { rateLimit, DATA_RATE_LIMITS } from "../../../lib/rate-limit";
import { validateBody, ImportCreateSchema } from "../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../lib/audit";

type AppwriteDocument = { $id: string; [key: string]: unknown };

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

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
  databaseId: string,
  workspaceId: string
): Promise<string[]> {
  try {
    const response = await databases.listDocuments(databaseId, "categories", [
      Query.equal("workspace_id", workspaceId)
    ]);
    const names = response.documents
      .map((doc) => String(doc.name ?? "").trim())
      .filter(Boolean);
    return names.length ? names : DEFAULT_CATEGORY_NAMES;
  } catch {
    return DEFAULT_CATEGORY_NAMES;
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
  const trimmed = value.trim();

  // Handle DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (common in AU bank exports)
  const ddmmMatch = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (ddmmMatch) {
    const day = Number(ddmmMatch[1]);
    const month = Number(ddmmMatch[2]);
    const year = Number(
      ddmmMatch[3].length === 2 ? `20${ddmmMatch[3]}` : ddmmMatch[3]
    );
    if (Number.isFinite(day) && Number.isFinite(month) && Number.isFinite(year)) {
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.valueOf())) return d;
    }
  }

  const parsed = new Date(trimmed);
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl,
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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl,
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
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.bulk);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check write permission
    await requireWorkspacePermission(workspaceId, user.$id, 'write');
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const openRouterModel =
    process.env.OPENROUTER_MODEL ?? "xiaomi/mimo-v2-flash:free";

  const body = await request.json();
  const parsed = validateBody(ImportCreateSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { sourceName, fileName, rows, sourceAccount, sourceOwner } = parsed.data!;

  const importId = ID.unique();
  const importDoc = {
    workspace_id: workspaceId,
    source_name: sourceName ?? "CSV",
    source_account: sourceAccount ?? "",
    source_owner: sourceOwner ?? "",
    file_name: fileName ?? "",
    row_count: rows.length,
    status: "imported",
    uploaded_at: new Date().toISOString()
  };

  await databases.createDocument(config.databaseId, "imports", importId, importDoc);

  const createdTransactions: CategorizationInput[] = [];

  const workspace = await getWorkspaceById(workspaceId);
  const workspaceCurrency = workspace?.currency ?? "AUD";
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
    const normalizedDate = normalizeDateToISO(row.date ?? "");
    const transactionDoc = {
      workspace_id: workspaceId,
      import_id: importId,
      date: normalizedDate,
      description: row.description ?? "",
      amount,
      currency: row.currency ?? workspaceCurrency,
      account_name: row.account ?? sourceAccount ?? "Unassigned",
      source_account: sourceAccount ?? "",
      source_owner: sourceOwner ?? "",
      category_name: category,
      direction,
      notes: "",
      is_transfer: false,
      needs_review: category === "Uncategorised"
    };

    await databases.createDocument(
      config.databaseId,
      "transactions",
      transactionId,
      transactionDoc
    );

    createdTransactions.push({
      id: transactionId,
      date: normalizedDate,
      description: row.description ?? "",
      amount,
      account: row.account ?? sourceAccount ?? "Unassigned"
    });
  }

  const shouldAutoCategorize = rows.every((row) => {
    const rawCategory = row.category?.trim();
    if (!rawCategory) return true;
    const normalized = rawCategory.toLowerCase();
    return normalized === "unknown" || normalized === "uncategorised";
  });

  // Defer auto-categorization to run AFTER the response is sent.
  // This prevents the progress bar from getting stuck on "Importing..."
  // while the (slow) OpenRouter AI calls complete.
  if (shouldAutoCategorize && openRouterKey) {
    after(async () => {
      try {
        const categories = await loadWorkspaceCategories(databases, config.databaseId, workspaceId);
        const categorizedIds = new Set<string>();
        let remainingTransactions = createdTransactions;

        if (referenceDate && sourceAccount) {
          const range = getPreviousMonthRange(referenceDate);
          const historyResponse = await databases.listDocuments(
            config.databaseId,
            "transactions",
            [
              Query.equal("workspace_id", workspaceId),
              Query.equal("source_account", sourceAccount),
              Query.orderDesc("date"),
              Query.limit(400)
            ]
          );
          type HistoryItem = { id: string; date: string; description: string; amount: string; category: string };
          const history: HistoryItem[] = historyResponse.documents
            .map((doc: AppwriteDocument) => ({
              id: doc.$id,
              date: String(doc.date ?? ""),
              description: String(doc.description ?? ""),
              amount: String(doc.amount ?? ""),
              category: String(doc.category_name ?? "Uncategorised")
            }))
            .filter((doc: HistoryItem) => doc.category !== "Uncategorised")
            .filter((doc: HistoryItem) => {
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
                config.databaseId,
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
              config.databaseId,
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
    });
  }

    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "import",
      resource_type: "import",
      resource_id: importId,
      summary: `Imported ${rows.length} rows from ${sourceName ?? "CSV"}`,
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ importId });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error('Import POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.read);
  if (blocked) return blocked;

  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { error: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;

    // Check read permission
    await requireWorkspacePermission(workspaceId, user.$id, 'read');

  const response = await databases.listDocuments(config.databaseId, "imports", [
    Query.equal("workspace_id", workspaceId),
    Query.orderDesc("uploaded_at"),
    Query.limit(30)
  ]);

    const imports = response.documents.map((doc: AppwriteDocument) => ({
      id: doc.$id,
      source_name: doc.source_name,
      source_owner: doc.source_owner,
      file_name: doc.file_name,
      row_count: doc.row_count,
      status: doc.status,
      uploaded_at: doc.uploaded_at
    }));

    return NextResponse.json(
      { imports },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0"
        }
      }
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    console.error('Import GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
