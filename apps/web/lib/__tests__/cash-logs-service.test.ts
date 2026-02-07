import { describe, it, expect } from "vitest";
import { safeParseParsedItems } from "../cash-logs-service";

describe("safeParseParsedItems", () => {
  it("parses a valid JSON array", () => {
    const input = JSON.stringify([
      { description: "Coffee", amount: 5, category: "Food" },
    ]);
    const result = safeParseParsedItems(input);
    expect(result).toEqual([
      { description: "Coffee", amount: 5, category: "Food" },
    ]);
  });

  it("returns null for a valid JSON object (not an array)", () => {
    expect(safeParseParsedItems('{"key": "value"}')).toBeNull();
  });

  it("returns null for invalid JSON", () => {
    expect(safeParseParsedItems("not json")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(safeParseParsedItems("")).toBeNull();
  });

  it("returns an empty array for '[]'", () => {
    expect(safeParseParsedItems("[]")).toEqual([]);
  });

  it("parses a multi-item array", () => {
    const items = [
      { description: "Rent", amount: 1200, category: "Housing" },
      { description: "Salary", amount: 5000, category: "Income - Primary" },
    ];
    expect(safeParseParsedItems(JSON.stringify(items))).toEqual(items);
  });

  it("returns null for a JSON string primitive", () => {
    expect(safeParseParsedItems('"hello"')).toBeNull();
  });

  it("returns null for a JSON number primitive", () => {
    expect(safeParseParsedItems("42")).toBeNull();
  });
});
