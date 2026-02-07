// pdfjs-dist (used by pdf-parse) expects the browser-only DOMMatrix API.
// Polyfill it for Node.js / edge server environments so text extraction works.
if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-expect-error -- minimal stub; only text extraction is used, not canvas rendering
  globalThis.DOMMatrix = class DOMMatrix {
    m11 = 1; m12 = 0; m13 = 0; m14 = 0;
    m21 = 0; m22 = 1; m23 = 0; m24 = 0;
    m31 = 0; m32 = 0; m33 = 1; m34 = 0;
    m41 = 0; m42 = 0; m43 = 0; m44 = 1;
    a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
    is2D = true;
    isIdentity = true;

    constructor(init?: number[] | string) {
      if (Array.isArray(init)) {
        const v = init;
        this.m11 = v[0] ?? 1; this.m12 = v[1] ?? 0;
        this.m13 = v[2] ?? 0; this.m14 = v[3] ?? 0;
        this.m21 = v[4] ?? 0; this.m22 = v[5] ?? 1;
        this.m23 = v[6] ?? 0; this.m24 = v[7] ?? 0;
        this.m31 = v[8] ?? 0; this.m32 = v[9] ?? 0;
        this.m33 = v[10] ?? 1; this.m34 = v[11] ?? 0;
        this.m41 = v[12] ?? 0; this.m42 = v[13] ?? 0;
        this.m43 = v[14] ?? 0; this.m44 = v[15] ?? 1;
        this.a = this.m11; this.b = this.m12;
        this.c = this.m21; this.d = this.m22;
        this.e = this.m41; this.f = this.m42;
      }
    }

    inverse() { return new DOMMatrix(); }
    multiply() { return new DOMMatrix(); }
    scale() { return new DOMMatrix(); }
    translate() { return new DOMMatrix(); }
    toString() { return "matrix(1,0,0,1,0,0)"; }
    static fromMatrix() { return new DOMMatrix(); }
    static fromFloat64Array(a: Float64Array) { return new DOMMatrix(Array.from(a)); }
    static fromFloat32Array(a: Float32Array) { return new DOMMatrix(Array.from(a)); }
  };
}

import { PDFParse } from "pdf-parse";
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
