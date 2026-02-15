import { describe, it, expect } from "vitest";
import {
  validatePresetName,
  validateHeaderMap,
  parseHeaderMap,
  VALID_MAPPING_KEYS,
} from "../import-presets";

describe("validatePresetName", () => {
  it("rejects undefined", () => {
    expect(validatePresetName(undefined)).toBe("Preset name is required.");
  });

  it("rejects null", () => {
    expect(validatePresetName(null)).toBe("Preset name is required.");
  });

  it("rejects empty string", () => {
    expect(validatePresetName("")).toBe("Preset name is required.");
  });

  it("rejects whitespace-only string", () => {
    expect(validatePresetName("   ")).toBe("Preset name is required.");
  });

  it("rejects non-string types", () => {
    expect(validatePresetName(42)).toBe("Preset name is required.");
    expect(validatePresetName(true)).toBe("Preset name is required.");
  });

  it("accepts valid name", () => {
    expect(validatePresetName("Westpac CSV")).toBeNull();
  });

  it("accepts name with leading/trailing whitespace (trimmed length checked)", () => {
    expect(validatePresetName("  My Preset  ")).toBeNull();
  });

  it("rejects name exceeding 200 characters", () => {
    const longName = "A".repeat(201);
    expect(validatePresetName(longName)).toBe(
      "Preset name must be 200 characters or fewer."
    );
  });

  it("accepts name exactly 200 characters", () => {
    expect(validatePresetName("A".repeat(200))).toBeNull();
  });
});

describe("validateHeaderMap", () => {
  it("rejects undefined", () => {
    expect(validateHeaderMap(undefined)).toBe(
      "headerMap is required and must be a non-empty object."
    );
  });

  it("rejects null", () => {
    expect(validateHeaderMap(null)).toBe(
      "headerMap is required and must be a non-empty object."
    );
  });

  it("rejects empty object", () => {
    expect(validateHeaderMap({})).toBe(
      "headerMap is required and must be a non-empty object."
    );
  });

  it("rejects arrays", () => {
    expect(validateHeaderMap(["date"])).toBe(
      "headerMap is required and must be a non-empty object."
    );
  });

  it("rejects non-objects", () => {
    expect(validateHeaderMap("date")).toBe(
      "headerMap is required and must be a non-empty object."
    );
    expect(validateHeaderMap(42)).toBe(
      "headerMap is required and must be a non-empty object."
    );
  });

  it("accepts valid mapping with all valid keys", () => {
    expect(
      validateHeaderMap({
        Date: "date",
        Narrative: "description",
        "Debit Amount": "debit",
        "Credit Amount": "credit",
        Balance: "ignore",
      })
    ).toBeNull();
  });

  it("rejects invalid mapping value", () => {
    expect(
      validateHeaderMap({ Date: "date", Foo: "bogus" })
    ).toBe('Invalid mapping value "bogus" for header "Foo".');
  });

  it("rejects empty header name", () => {
    expect(
      validateHeaderMap({ "": "date" })
    ).toBe("Header names must not be empty.");
  });

  it("rejects whitespace-only header name", () => {
    expect(
      validateHeaderMap({ "  ": "date" })
    ).toBe("Header names must not be empty.");
  });

  it("rejects non-string mapping value", () => {
    expect(
      validateHeaderMap({ Date: 123 })
    ).toBe('Invalid mapping value "123" for header "Date".');
  });

  it("accepts all valid mapping key types", () => {
    const map: Record<string, string> = {};
    const keys = [...VALID_MAPPING_KEYS];
    keys.forEach((key, i) => {
      map[`Col${i}`] = key;
    });
    expect(validateHeaderMap(map)).toBeNull();
  });

  it("validates every valid key is in the set", () => {
    const expected = new Set([
      "ignore", "date", "description", "amount",
      "debit", "credit", "account", "category", "currency",
    ]);
    expect(VALID_MAPPING_KEYS).toEqual(expected);
  });
});

describe("parseHeaderMap", () => {
  it("parses valid JSON object", () => {
    const json = JSON.stringify({ Date: "date", Amount: "amount" });
    expect(parseHeaderMap(json)).toEqual({ Date: "date", Amount: "amount" });
  });

  it("returns null for invalid JSON", () => {
    expect(parseHeaderMap("not json")).toBeNull();
  });

  it("returns null for JSON array", () => {
    expect(parseHeaderMap('["date"]')).toBeNull();
  });

  it("returns null for JSON null", () => {
    expect(parseHeaderMap("null")).toBeNull();
  });

  it("returns null for JSON string", () => {
    expect(parseHeaderMap('"hello"')).toBeNull();
  });

  it("returns null for JSON number", () => {
    expect(parseHeaderMap("42")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(parseHeaderMap("")).toBeNull();
  });

  it("handles nested objects (returns them as-is since they pass typeof check)", () => {
    const json = JSON.stringify({ Date: { nested: true } });
    const result = parseHeaderMap(json);
    // parseHeaderMap only checks top-level is an object; validateHeaderMap catches invalid values
    expect(result).toEqual({ Date: { nested: true } });
  });

  it("handles corrupted JSON with trailing characters", () => {
    // JSON.parse is strict about trailing content
    expect(parseHeaderMap('{"Date":"date"} extra')).toBeNull();
  });

  it("handles empty JSON object", () => {
    expect(parseHeaderMap("{}")).toEqual({});
  });

  it("preserves all key-value pairs in a real Westpac-style mapping", () => {
    const westpacMap = {
      "Bank Account": "account",
      Date: "date",
      Narrative: "description",
      "Debit Amount": "debit",
      "Credit Amount": "credit",
      Balance: "ignore",
      Categories: "ignore",
      Serial: "ignore",
    };
    const json = JSON.stringify(westpacMap);
    expect(parseHeaderMap(json)).toEqual(westpacMap);
  });
});
