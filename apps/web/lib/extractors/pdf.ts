import type {
  TransactionExtractor,
  ExtractionResult,
  ExtractedRow,
  ExtractorOptions,
} from "./types";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "xiaomi/mimo-v2-flash:free";

export function extractJsonArray(text: string): ExtractedRow[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export class PdfExtractor implements TransactionExtractor {
  readonly source = "PDF";
  readonly accepts = [".pdf", "application/pdf"];

  async extract(
    input: Buffer,
    options?: ExtractorOptions
  ): Promise<ExtractionResult> {
    const apiKey = options?.openRouterKey ?? process.env.OPENROUTER_API_KEY;
    const model =
      options?.openRouterModel ??
      process.env.OPENROUTER_MODEL ??
      DEFAULT_MODEL;

    if (!apiKey) {
      throw new Error(
        "OpenRouter API key is required for PDF extraction. Set OPENROUTER_API_KEY."
      );
    }

    // 1. Extract raw text from PDF
    // Dynamic import so pdfjs-dist is loaded AFTER the DOMMatrix polyfill
    // registered in instrumentation.ts / server-polyfills.ts has executed.
    // A static import would be hoisted above any module-level polyfill code.
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: input });
    const textResult = await parser.getText();
    const rawText = textResult.text;

    if (!rawText.trim()) {
      return { rows: [], source: this.source, warnings: ["PDF contained no extractable text."] };
    }

    // 2. Use LLM to parse transactions from the raw text
    const rows = await this.parseWithLlm(rawText, apiKey, model);

    const warnings: string[] = [];
    if (rows.length === 0) {
      warnings.push("No transactions could be extracted from the PDF.");
    }

    return { rows, source: this.source, warnings };
  }

  private async parseWithLlm(
    text: string,
    apiKey: string,
    model: string
  ): Promise<ExtractedRow[]> {
    const systemPrompt = [
      "You are a financial document parser.",
      "Extract every transaction from the bank/credit card statement text below.",
      "For each transaction return: date (ISO YYYY-MM-DD), description, amount (negative for debits/purchases, positive for credits/payments).",
      "Include account name if visible in the statement.",
      "Skip summary rows, opening/closing balances, headers, footers, and non-transaction text.",
      'Return ONLY a JSON array: [{"date":"...","description":"...","amount":"...","account":"..."}].',
      "If you cannot extract any transactions, return an empty array [].",
    ].join(" ");

    const userPrompt = [
      "Extract all transactions from this statement:",
      "",
      text,
    ].join("\n");

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3000",
        "X-Title": "Finance Mgmt Tool",
      },
      body: JSON.stringify({
        model,
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
    const rows = extractJsonArray(content);

    if (!rows) return [];

    // Normalise each row to ensure consistent shape
    return rows
      .filter(
        (row) =>
          typeof row.date === "string" &&
          typeof row.description === "string" &&
          (typeof row.amount === "string" || typeof row.amount === "number")
      )
      .map((row) => ({
        date: row.date,
        description: row.description,
        amount: String(row.amount),
        account: row.account ?? "",
        category: row.category ?? "",
        currency: row.currency ?? "",
      }));
  }
}
