/**
 * Channel-agnostic transaction extraction pipeline.
 *
 * Every input channel (CSV, PDF, API, bank feed, etc.) produces the same
 * `ExtractedRow[]` output.  The `/api/imports` endpoint already accepts
 * this shape, so new channels only need to implement `TransactionExtractor`.
 */

export type ExtractedRow = {
  date: string;
  description: string;
  amount: string;
  account?: string;
  category?: string;
  currency?: string;
};

export type ExtractionResult = {
  rows: ExtractedRow[];
  /** Original source channel identifier (e.g. "CSV", "PDF", "API"). */
  source: string;
  /** Any warnings produced during extraction (e.g. skipped rows). */
  warnings?: string[];
};

export type ExtractorOptions = {
  /** Hint for which account this file belongs to. */
  sourceAccount?: string;
  /** OpenRouter API key – required for LLM-based extractors. */
  openRouterKey?: string;
  /** OpenRouter model identifier. */
  openRouterModel?: string;
};

/**
 * All input channel extractors implement this interface.
 *
 * The contract is simple: accept raw input (a Buffer for file-based channels,
 * or structured data for API channels) and return normalised rows.
 */
export interface TransactionExtractor {
  /** Human-readable channel name shown in import history. */
  readonly source: string;

  /** File extensions or MIME types this extractor handles (for routing). */
  readonly accepts: string[];

  /** Run extraction and return normalised rows. */
  extract(
    input: Buffer,
    options?: ExtractorOptions
  ): Promise<ExtractionResult>;
}
