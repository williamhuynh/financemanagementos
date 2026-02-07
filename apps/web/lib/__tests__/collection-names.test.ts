import { describe, it, expect } from "vitest";
import { COLLECTIONS } from "../collection-names";

describe("COLLECTIONS", () => {
  it("defines all required collections", () => {
    const required = [
      "WORKSPACE_MEMBERS",
      "WORKSPACE_INVITATIONS",
      "WORKSPACES",
      "TRANSACTIONS",
      "ASSETS",
      "CATEGORIES",
      "IMPORTS",
      "MONTHLY_SNAPSHOTS",
      "CASH_LOGS",
      "TRANSFER_PAIRS",
    ] as const;

    for (const key of required) {
      expect(COLLECTIONS).toHaveProperty(key);
      expect(typeof COLLECTIONS[key]).toBe("string");
      expect(COLLECTIONS[key].length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate collection names", () => {
    const values = Object.values(COLLECTIONS);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("uses snake_case naming convention", () => {
    for (const value of Object.values(COLLECTIONS)) {
      expect(value).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });
});
