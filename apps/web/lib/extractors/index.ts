export { PdfExtractor } from "./pdf";
export type {
  TransactionExtractor,
  ExtractionResult,
  ExtractedRow,
  ExtractorOptions,
} from "./types";

import { PdfExtractor } from "./pdf";
import type { TransactionExtractor } from "./types";

/** All registered extractors. Add new channels here. */
const extractors: TransactionExtractor[] = [new PdfExtractor()];

/**
 * Resolve an extractor for the given file extension or MIME type.
 * Returns `null` if no extractor handles the type.
 */
export function resolveExtractor(
  fileType: string
): TransactionExtractor | null {
  const normalized = fileType.toLowerCase();
  return (
    extractors.find((e) =>
      e.accepts.some((accept) => accept.toLowerCase() === normalized)
    ) ?? null
  );
}
