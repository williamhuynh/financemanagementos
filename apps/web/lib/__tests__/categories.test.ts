import { describe, it, expect } from "vitest";
import {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_NAMES,
  SYSTEM_CATEGORIES,
  isSystemCategory,
} from "../categories";

describe("DEFAULT_CATEGORIES", () => {
  it("includes all system categories", () => {
    const names = DEFAULT_CATEGORIES.map(c => c.name);
    for (const sc of SYSTEM_CATEGORIES) {
      expect(names).toContain(sc);
    }
  });

  it("has the correct number of default categories", () => {
    expect(DEFAULT_CATEGORIES.length).toBe(20);
  });

  it("income categories have group 'income'", () => {
    const incomeCategories = DEFAULT_CATEGORIES.filter(c => c.group === "income");
    expect(incomeCategories.length).toBe(2);
    expect(incomeCategories.map(c => c.name)).toContain("Income - Primary");
    expect(incomeCategories.map(c => c.name)).toContain("Income - Secondary");
  });

  it("system categories have null group", () => {
    for (const sc of SYSTEM_CATEGORIES) {
      const cat = DEFAULT_CATEGORIES.find(c => c.name === sc);
      expect(cat).toBeDefined();
      expect(cat!.group).toBeNull();
    }
  });

  it("all non-system, non-income categories are expense", () => {
    const expenseCategories = DEFAULT_CATEGORIES.filter(
      c => c.group === "expense"
    );
    expect(expenseCategories.length).toBe(16);
  });
});

describe("DEFAULT_CATEGORY_NAMES", () => {
  it("is a string array matching DEFAULT_CATEGORIES names", () => {
    expect(DEFAULT_CATEGORY_NAMES).toEqual(DEFAULT_CATEGORIES.map(c => c.name));
  });
});

describe("SYSTEM_CATEGORIES", () => {
  it("contains Transfer and Uncategorised", () => {
    expect(SYSTEM_CATEGORIES).toContain("Transfer");
    expect(SYSTEM_CATEGORIES).toContain("Uncategorised");
  });

  it("has exactly 2 entries", () => {
    expect(SYSTEM_CATEGORIES.length).toBe(2);
  });
});

describe("isSystemCategory", () => {
  it("returns true for Transfer", () => {
    expect(isSystemCategory("Transfer")).toBe(true);
  });

  it("returns true for Uncategorised", () => {
    expect(isSystemCategory("Uncategorised")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSystemCategory("transfer")).toBe(true);
    expect(isSystemCategory("UNCATEGORISED")).toBe(true);
  });

  it("handles whitespace", () => {
    expect(isSystemCategory("  Transfer  ")).toBe(true);
  });

  it("returns false for non-system categories", () => {
    expect(isSystemCategory("Housing")).toBe(false);
    expect(isSystemCategory("Income - Primary")).toBe(false);
    expect(isSystemCategory("Groceries")).toBe(false);
  });

  it("category name validation: empty string is not a system category", () => {
    expect(isSystemCategory("")).toBe(false);
  });
});
