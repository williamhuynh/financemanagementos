import { NextResponse } from "next/server";
import { Query } from "node-appwrite";
import { getApiContext } from "../../../lib/api-auth";
import { requireWorkspacePermission } from "../../../lib/workspace-guard";
import { COLLECTIONS } from "../../../lib/collection-names";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

type MappingKey =
  | "ignore"
  | "date"
  | "description"
  | "amount"
  | "debit"
  | "credit"
  | "account"
  | "category"
  | "currency";

const VALID_KEYS = new Set<string>([
  "ignore", "date", "description", "amount",
  "debit", "credit", "account", "category", "currency",
]);

type RecentMapping = {
  headers: string[];
  mapping: Record<string, MappingKey>;
  invertAmount?: boolean;
};

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/suggest-mapping
 *
 * Uses an LLM to suggest column mappings for a CSV file and detect
 * whether the amount sign needs inverting.
 *
 * Body (JSON):
 *   headers       – string[]              column headers from the CSV
 *   sampleRows    – string[][]            first 3-5 data rows
 *   recentMappings – RecentMapping[]      few-shot examples from past imports
 */
export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    if (!ctx) {
      return NextResponse.json(
        { detail: "Unauthorized or missing configuration." },
        { status: 401 }
      );
    }

    const { databases, config, workspaceId, user } = ctx;
    await requireWorkspacePermission(workspaceId, user.$id, "write");

    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const openRouterModel =
      process.env.OPENROUTER_MODEL ?? "xiaomi/mimo-v2-flash:free";

    if (!openRouterKey) {
      return NextResponse.json(
        { detail: "OpenRouter API key not configured." },
        { status: 502 }
      );
    }

    const body = (await request.json()) as {
      headers?: string[];
      sampleRows?: string[][];
      recentMappings?: RecentMapping[];
    };

    const headers = body.headers ?? [];
    const sampleRows = body.sampleRows ?? [];
    const recentMappings = body.recentMappings ?? [];

    if (headers.length === 0) {
      return NextResponse.json(
        { detail: "No headers provided." },
        { status: 400 }
      );
    }

    const systemPrompt = [
      "You are a CSV column mapper for financial transaction imports.",
      "Given column headers and sample data rows, map each column to exactly one of these types:",
      "- date: Transaction date",
      "- description: Transaction description, narrative, payee, or merchant name",
      "- amount: Single amount column (negative = debit, positive = credit)",
      "- debit: Debit/expense amount only (always positive in the CSV)",
      "- credit: Credit/income amount only (always positive in the CSV)",
      "- account: Account name or number",
      "- category: Transaction category",
      "- currency: Currency code",
      "- ignore: Not relevant (e.g. balance, serial number, reference ID, running total)",
      "",
      "Rules:",
      "- You MUST assign at least: date, description, and either amount OR (debit + credit).",
      "- Only one column should map to each type, except ignore which can be used multiple times.",
      "- Use sample data to disambiguate when headers are ambiguous or missing.",
      "- Columns showing running balances or totals should be ignore.",
      "",
      "Amount sign detection:",
      "- Look at the sample data. If transactions that are clearly purchases/expenses (e.g. supermarkets, restaurants, subscriptions) have POSITIVE amounts, set invertAmount to true.",
      "- If purchases have negative amounts (the normal convention), set invertAmount to false.",
      "- If using separate debit/credit columns, set invertAmount to false.",
      "- Only set invertAmount to true when you are confident the sign is reversed.",
      "",
      'Return ONLY a JSON object: {"mapping": {"Header1": "type", ...}, "invertAmount": false}',
    ].join("\n");

    // Load saved workspace presets as additional few-shot examples
    let savedPresets: RecentMapping[] = [];
    try {
      const presetDocs = await databases.listDocuments(
        config.databaseId,
        COLLECTIONS.IMPORT_PRESETS,
        [
          Query.equal("workspace_id", workspaceId),
          Query.limit(10),
        ]
      );
      savedPresets = presetDocs.documents.map((doc: { header_map: string; invert_amount: boolean }) => {
        const headerMap = JSON.parse(doc.header_map) as Record<string, MappingKey>;
        return {
          headers: Object.keys(headerMap),
          mapping: headerMap,
          invertAmount: Boolean(doc.invert_amount),
        };
      });
    } catch {
      // Saved presets not available — continue without them
    }

    // Merge: saved workspace presets first, then client-provided recent mappings
    const allExamples = [...savedPresets, ...recentMappings].slice(0, 8);

    const exampleLines: string[] = [];
    for (const example of allExamples) {
      const mappingStr = JSON.stringify(example.mapping);
      const invertStr = example.invertAmount ? "true" : "false";
      exampleLines.push(
        `Headers: ${JSON.stringify(example.headers)}\n→ {"mapping": ${mappingStr}, "invertAmount": ${invertStr}}`
      );
    }

    const sampleRowLines = sampleRows
      .slice(0, 5)
      .map((row, i) => `Row ${i + 1}: ${JSON.stringify(row)}`);

    const userPrompt = [
      `Headers: ${JSON.stringify(headers)}`,
      "",
      "Sample data:",
      ...sampleRowLines,
      ...(exampleLines.length
        ? [
            "",
            "Previous successful mappings from this workspace:",
            ...exampleLines,
          ]
        : []),
    ].join("\n");

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": appUrl,
        "X-Title": "Finance Mgmt Tool",
      },
      body: JSON.stringify({
        model: openRouterModel,
        temperature: 0.1,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter request failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = extractJsonObject(content);

    if (!parsed) {
      return NextResponse.json(
        { detail: "Failed to parse LLM response." },
        { status: 502 }
      );
    }

    // Normalise: the LLM might return mapping at top level or nested
    const rawMapping = (
      typeof parsed.mapping === "object" && parsed.mapping !== null
        ? parsed.mapping
        : parsed
    ) as Record<string, string>;

    const mapping: Record<string, string> = {};
    for (const header of headers) {
      const suggested = rawMapping[header];
      if (typeof suggested === "string" && VALID_KEYS.has(suggested)) {
        mapping[header] = suggested;
      } else {
        mapping[header] = "ignore";
      }
    }

    const invertAmount = Boolean(parsed.invertAmount);

    return NextResponse.json({ mapping, invertAmount });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("not member")) {
        return NextResponse.json(
          { error: "Access denied" },
          { status: 403 }
        );
      }
      if (error.message.includes("Insufficient permission")) {
        return NextResponse.json(
          { error: "Insufficient permissions" },
          { status: 403 }
        );
      }
      if (error.message.includes("OpenRouter")) {
        return NextResponse.json(
          { detail: error.message },
          { status: 502 }
        );
      }
    }
    console.error("Suggest-mapping POST error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
