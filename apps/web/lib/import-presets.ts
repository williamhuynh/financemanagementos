/**
 * Shared validation logic for import presets.
 * Used by API routes and tested independently.
 */

const VALID_MAPPING_KEYS = new Set<string>([
  "ignore", "date", "description", "amount",
  "debit", "credit", "account", "category", "currency",
]);

export type PresetValidationError = {
  error: string;
};

/**
 * Validate a preset name. Returns an error message or null if valid.
 */
export function validatePresetName(name: unknown): string | null {
  if (typeof name !== "string" || !name.trim()) {
    return "Preset name is required.";
  }
  if (name.trim().length > 200) {
    return "Preset name must be 200 characters or fewer.";
  }
  return null;
}

/**
 * Validate a headerMap object. Returns an error message or null if valid.
 */
export function validateHeaderMap(
  headerMap: unknown
): string | null {
  if (
    !headerMap ||
    typeof headerMap !== "object" ||
    Array.isArray(headerMap) ||
    Object.keys(headerMap as object).length === 0
  ) {
    return "headerMap is required and must be a non-empty object.";
  }

  for (const [header, value] of Object.entries(headerMap as Record<string, unknown>)) {
    if (!header.trim()) {
      return "Header names must not be empty.";
    }
    if (typeof value !== "string" || !VALID_MAPPING_KEYS.has(value)) {
      return `Invalid mapping value "${String(value)}" for header "${header}".`;
    }
  }

  return null;
}

/**
 * Safely parse a header_map JSON string. Returns the parsed object or null.
 */
export function parseHeaderMap(raw: string): Record<string, string> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, string>;
  } catch {
    return null;
  }
}

export { VALID_MAPPING_KEYS };
