import { NextResponse } from "next/server";
import { getApiContext } from "../../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../../lib/workspace-guard";
import { rateLimit, DATA_RATE_LIMITS } from "../../../../lib/rate-limit";
import { validateBody, CashLogProcessSchema } from "../../../../lib/validations";
import { writeAuditLog, getClientIp } from "../../../../lib/audit";

export const dynamic = "force-dynamic";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type ParsedItem = {
  description: string;
  amount: number;
  category: string;
  confidence?: number;
};

function extractJsonArray(text: string): unknown[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function parseAndCategorize(
  logText: string,
  isIncome: boolean,
  categories: string[],
  apiKey: string,
  model: string
): Promise<ParsedItem[]> {
  const systemPrompt = `You are a financial transaction parser. Parse free-text expense/income logs into individual transactions.

Your job:
1. Extract each item mentioned with its amount
2. Assign the most appropriate category from the provided list
3. Return a JSON array of parsed items

Rules:
- Parse amounts like "$20.10", "20 dollars", "15", etc. into numbers
- If no dollar sign, assume the number is dollars
- Split multiple items (e.g., "eggs $20 rice $15" = 2 items)
- Use context clues for categorization (groceries, food, transport, etc.)
- If unsure of category, use "Uncategorised"
- Return confidence 0-1 for category assignment

Return ONLY a JSON array: [{"description":"item name","amount":20.10,"category":"Category Name","confidence":0.9}]`;

  const transactionType = isIncome ? "income" : "expense";
  const userPrompt = `Parse this ${transactionType} log into transactions:

"${logText}"

Available categories: ${categories.join(", ")}

Return JSON array of parsed items.`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": appUrl,
      "X-Title": "Finance Mgmt Tool - Cash Log"
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
    console.error("OpenRouter request failed:", response.status);
    return fallbackParse(logText, isIncome, categories);
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = payload.choices?.[0]?.message?.content ?? "";
  const parsed = extractJsonArray(content);

  if (!parsed || parsed.length === 0) {
    return fallbackParse(logText, isIncome, categories);
  }

  // Validate and normalize parsed items
  return parsed
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      description: String(item.description ?? "Unknown item"),
      amount: typeof item.amount === "number" ? item.amount : parseFloat(String(item.amount)) || 0,
      category: categories.includes(String(item.category)) ? String(item.category) : "Uncategorised",
      confidence: typeof item.confidence === "number" ? item.confidence : 0.7
    }))
    .filter((item) => item.amount > 0);
}

// Fallback parsing when AI fails
function fallbackParse(text: string, isIncome: boolean, allowedCategories?: string[]): ParsedItem[] {
  const items: ParsedItem[] = [];

  // Match patterns like "eggs $20.10" or "eggs 20.10" or "$20.10 eggs"
  const patterns = [
    // "item $amount" or "item amount"
    /([a-zA-Z][a-zA-Z\s]*?)\s*\$?(\d+(?:\.\d{2})?)/gi,
    // "$amount item"
    /\$(\d+(?:\.\d{2})?)\s+([a-zA-Z][a-zA-Z\s]*?)(?=\s*\$|\s*\d|$)/gi
  ];

  const matches = new Set<string>();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let description: string;
      let amount: number;

      if (pattern.source.startsWith("\\$")) {
        // "$amount item" pattern
        amount = parseFloat(match[1]);
        description = match[2].trim();
      } else {
        // "item $amount" pattern
        description = match[1].trim();
        amount = parseFloat(match[2]);
      }

      const key = `${description.toLowerCase()}-${amount}`;
      if (!matches.has(key) && description.length > 0 && amount > 0) {
        matches.add(key);
        items.push({
          description: description.charAt(0).toUpperCase() + description.slice(1).toLowerCase(),
          amount,
          category: guessCategory(description, isIncome, allowedCategories),
          confidence: 0.5
        });
      }
    }
  }

  // If no matches, try to find just amounts
  if (items.length === 0) {
    const amountMatches = text.match(/\$?\d+(?:\.\d{2})?/g);
    if (amountMatches) {
      amountMatches.forEach((m, i) => {
        const amount = parseFloat(m.replace("$", ""));
        if (amount > 0) {
          items.push({
            description: `Item ${i + 1}`,
            amount,
            category: isIncome ? "Income - Secondary" : "Uncategorised",
            confidence: 0.3
          });
        }
      });
    }
  }

  return items;
}

function guessCategory(
  description: string,
  isIncome: boolean,
  allowedCategories?: string[]
): string {
  const categorySet = allowedCategories
    ? new Map(allowedCategories.map(c => [c.toLowerCase(), c]))
    : null;

  function resolve(name: string): string {
    if (!categorySet) return name;
    return categorySet.get(name.toLowerCase()) ?? "Uncategorised";
  }

  if (isIncome) {
    return resolve("Income - Secondary");
  }

  const lower = description.toLowerCase();

  const groceryKeywords = [
    "egg", "rice", "milk", "bread", "vegetable", "fruit", "meat", "chicken",
    "fish", "pork", "beef", "tofu", "noodle", "pasta", "sauce", "oil",
    "sugar", "flour", "butter", "cheese", "yogurt", "cereal"
  ];
  if (groceryKeywords.some((k) => lower.includes(k))) {
    return resolve("Groceries");
  }

  const foodKeywords = [
    "coffee", "lunch", "dinner", "breakfast", "snack", "drink", "tea",
    "cafe", "restaurant", "takeaway", "pizza", "burger", "sandwich"
  ];
  if (foodKeywords.some((k) => lower.includes(k))) {
    return resolve("Food");
  }

  const transportKeywords = [
    "uber", "taxi", "bus", "train", "fuel", "petrol", "gas", "parking",
    "toll", "opal", "myki", "transport"
  ];
  if (transportKeywords.some((k) => lower.includes(k))) {
    return resolve("Transportation");
  }

  const medicalKeywords = [
    "pharmacy", "medicine", "doctor", "hospital", "health", "chemist",
    "prescription"
  ];
  if (medicalKeywords.some((k) => lower.includes(k))) {
    return resolve("Medical, Healthcare & Fitness");
  }

  return "Uncategorised";
}

export async function POST(request: Request) {
  const blocked = await rateLimit(request, DATA_RATE_LIMITS.ai);
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

    // Check admin permission (processing cash logs is an admin operation)
    await requireWorkspacePermission(workspaceId, user.$id, 'admin');

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel = process.env.OPENROUTER_MODEL ?? "xiaomi/mimo-v2-flash:free";
    const body = await request.json();

    const parsed = validateBody(CashLogProcessSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { logIds, categories: inputCategories } = parsed.data;

    const categories = inputCategories.length > 0
      ? inputCategories
      : [
          "Groceries",
          "Food",
          "Transportation",
          "Personal Spending",
          "Recreation & Entertainment",
          "Medical, Healthcare & Fitness",
          "Utilities",
          "Housing",
          "Income - Primary",
          "Income - Secondary",
          "Uncategorised"
        ];

    const processed: Array<{ logId: string; items: ParsedItem[] }> = [];

    for (const logId of logIds) {
      try {
        // Fetch the log
        const doc = await databases.getDocument(
          config.databaseId,
          "cash_logs",
          logId
        );

        const logText = String(doc.text ?? "");
        const isIncome = Boolean(doc.isIncome);

        let items: ParsedItem[];

        try {
          if (openRouterKey) {
            items = await parseAndCategorize(
              logText,
              isIncome,
              categories,
              openRouterKey,
              openRouterModel
            );
          } else {
            items = fallbackParse(logText, isIncome, categories);
          }

          // If no items were parsed, create a default editable item
          if (items.length === 0) {
            items = [{
              description: logText.substring(0, 50) + (logText.length > 50 ? "..." : ""),
              amount: 0,
              category: isIncome ? "Income - Secondary" : "Uncategorised",
              confidence: 0
            }];
          }
        } catch (parseError) {
          console.error(`AI/parsing error for log ${logId}:`, parseError);
          // Create a default editable item if parsing completely fails
          items = [{
            description: logText.substring(0, 50) + (logText.length > 50 ? "..." : ""),
            amount: 0,
            category: isIncome ? "Income - Secondary" : "Uncategorised",
            confidence: 0
          }];
        }

        // Update the log with parsed items
        await databases.updateDocument(
          config.databaseId,
          "cash_logs",
          logId,
          {
            status: "processed",
            parsed_items: JSON.stringify(items)
          }
        );

        processed.push({ logId, items });
      } catch (error) {
        console.error(`Failed to process log ${logId}:`, error);
        // Even if database update fails, try to provide a processable item
        try {
          const doc = await databases.getDocument(
            config.databaseId,
            "cash_logs",
            logId
          );
          const logText = String(doc.text ?? "");
          const isIncome = Boolean(doc.isIncome);

          // Provide a default item that can be manually edited
          processed.push({
            logId,
            items: [{
              description: logText.substring(0, 50) + (logText.length > 50 ? "..." : ""),
              amount: 0,
              category: isIncome ? "Income - Secondary" : "Uncategorised",
              confidence: 0
            }]
          });
        } catch {
          // Skip this log entirely if we can't even fetch it
        }
      }
    }

    // Audit: fire-and-forget
    writeAuditLog(databases, config.databaseId, {
      workspace_id: workspaceId,
      user_id: user.$id,
      action: "update",
      resource_type: "cash_log",
      resource_id: logIds.join(","),
      summary: `Processed ${processed.length} cash log(s) via AI`,
      metadata: { logIds, totalItems: processed.reduce((n, g) => n + g.items.length, 0) },
      ip_address: getClientIp(request),
    });

    return NextResponse.json({ processed });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('not member')) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      if (error.message.includes('Insufficient permission')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
    }
    console.error("Failed to process cash logs:", error);
    return NextResponse.json(
      { error: "Failed to process cash logs." },
      { status: 500 }
    );
  }
}
