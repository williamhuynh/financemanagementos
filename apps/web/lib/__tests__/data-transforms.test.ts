import { describe, it, expect } from "vitest";
import {
  parseAmountValue,
  parseDateValue,
  normalizeDateToISO,
  isTransferCategory,
  isIncomeCategory,
  maskCurrencyValue,
  normalizeLedgerFilters,
  normalizeReviewFilters,
  toSignedAssetValue,
  formatDirectionLabel,
} from "../data";

describe("parseAmountValue", () => {
  it("parses a plain number string", () => {
    expect(parseAmountValue("42.50")).toBe(42.5);
  });

  it("strips commas before parsing", () => {
    expect(parseAmountValue("1,234.56")).toBe(1234.56);
  });

  it("parses negative amounts", () => {
    expect(parseAmountValue("-500")).toBe(-500);
  });

  it("returns null for non-numeric strings", () => {
    expect(parseAmountValue("abc")).toBeNull();
  });

  it("treats empty string as 0 (Number('') === 0)", () => {
    expect(parseAmountValue("")).toBe(0);
  });

  it("parses zero", () => {
    expect(parseAmountValue("0")).toBe(0);
  });

  it("returns null for Infinity", () => {
    expect(parseAmountValue("Infinity")).toBeNull();
  });
});

describe("parseDateValue", () => {
  it("parses ISO date strings", () => {
    const result = parseDateValue("2024-03-15T10:00:00.000Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2024-03-15T10:00:00.000Z");
  });

  it("parses DD/MM/YYYY format", () => {
    const result = parseDateValue("15/03/2024");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
    expect(result!.getMonth()).toBe(2); // 0-indexed → March
    expect(result!.getDate()).toBe(15);
  });

  it("parses DD-MM-YYYY format", () => {
    const result = parseDateValue("15-03-2024");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getDate()).toBe(15);
  });

  it("parses DD.MM.YY format (2-digit year)", () => {
    const result = parseDateValue("15.03.24");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getFullYear()).toBe(2024);
  });

  it("returns null for empty string", () => {
    expect(parseDateValue("")).toBeNull();
  });

  it("returns null for garbage input", () => {
    expect(parseDateValue("not-a-date")).toBeNull();
  });
});

describe("isTransferCategory", () => {
  it("returns true for 'Transfer'", () => {
    expect(isTransferCategory("Transfer")).toBe(true);
  });

  it("returns true for categories containing 'transfer' (case-insensitive)", () => {
    expect(isTransferCategory("Bank Transfer")).toBe(true);
    expect(isTransferCategory("TRANSFER OUT")).toBe(true);
  });

  it("returns false for non-transfer categories", () => {
    expect(isTransferCategory("Groceries")).toBe(false);
    expect(isTransferCategory("Housing")).toBe(false);
  });
});

describe("isIncomeCategory", () => {
  it("returns true for 'Income'", () => {
    expect(isIncomeCategory("Income")).toBe(true);
  });

  it("returns true for 'Income - Primary'", () => {
    expect(isIncomeCategory("Income - Primary")).toBe(true);
  });

  it("returns true for 'Income - Secondary'", () => {
    expect(isIncomeCategory("Income - Secondary")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isIncomeCategory("INCOME")).toBe(true);
    expect(isIncomeCategory("income - primary")).toBe(true);
  });

  it("returns false for non-income categories", () => {
    expect(isIncomeCategory("Housing")).toBe(false);
    expect(isIncomeCategory("Groceries")).toBe(false);
  });

  it("handles whitespace trimming", () => {
    expect(isIncomeCategory("  Income  ")).toBe(true);
  });
});

describe("maskCurrencyValue", () => {
  it("returns the original value when isVisible is true", () => {
    expect(maskCurrencyValue("$1,234.56", true)).toBe("$1,234.56");
  });

  it("masks a standard dollar value", () => {
    const masked = maskCurrencyValue("$1,234.56", false);
    expect(masked).toBe("$12***");
  });

  it("masks a negative dollar value", () => {
    const masked = maskCurrencyValue("-$500.00", false);
    expect(masked).toBe("-$50***");
  });

  it("falls back to first-2-chars + *** for unrecognized format", () => {
    const masked = maskCurrencyValue("Free", false);
    expect(masked).toBe("Fr***");
  });

  it("masks a 3-letter currency code format", () => {
    const masked = maskCurrencyValue("AUD1,234.56", false);
    expect(masked).toBe("AUD12***");
  });
});

describe("normalizeLedgerFilters", () => {
  it("returns empty object for undefined input", () => {
    expect(normalizeLedgerFilters(undefined)).toEqual({});
  });

  it("strips account when set to 'all'", () => {
    expect(normalizeLedgerFilters({ account: "all" })).toEqual({});
  });

  it("preserves a real account name", () => {
    expect(normalizeLedgerFilters({ account: "Savings" })).toEqual({ account: "Savings" });
  });

  it("strips category when set to 'all'", () => {
    expect(normalizeLedgerFilters({ category: "all" })).toEqual({});
  });

  it("preserves a real category", () => {
    expect(normalizeLedgerFilters({ category: "Groceries" })).toEqual({ category: "Groceries" });
  });

  it("accepts 'inflow' and 'outflow' amount filters", () => {
    expect(normalizeLedgerFilters({ amount: "inflow" })).toEqual({ amount: "inflow" });
    expect(normalizeLedgerFilters({ amount: "outflow" })).toEqual({ amount: "outflow" });
  });

  it("rejects invalid amount filter values", () => {
    expect(normalizeLedgerFilters({ amount: "invalid" as any })).toEqual({});
  });

  it("validates month format YYYY-MM", () => {
    expect(normalizeLedgerFilters({ month: "2024-03" })).toEqual({ month: "2024-03" });
    expect(normalizeLedgerFilters({ month: "March" })).toEqual({});
    expect(normalizeLedgerFilters({ month: "2024-3" })).toEqual({});
  });

  it("accepts 'asc' and 'desc' sort values", () => {
    expect(normalizeLedgerFilters({ sort: "asc" })).toEqual({ sort: "asc" });
    expect(normalizeLedgerFilters({ sort: "desc" })).toEqual({ sort: "desc" });
  });

  it("rejects invalid sort values", () => {
    expect(normalizeLedgerFilters({ sort: "random" as any })).toEqual({});
  });
});

describe("normalizeReviewFilters", () => {
  it("returns empty object for undefined input", () => {
    expect(normalizeReviewFilters(undefined)).toEqual({});
  });

  it("strips account when set to 'all'", () => {
    expect(normalizeReviewFilters({ account: "all" })).toEqual({});
  });

  it("preserves a real account name", () => {
    expect(normalizeReviewFilters({ account: "Checking" })).toEqual({ account: "Checking" });
  });

  it("validates month format YYYY-MM", () => {
    expect(normalizeReviewFilters({ month: "2024-01" })).toEqual({ month: "2024-01" });
    expect(normalizeReviewFilters({ month: "bad" })).toEqual({});
  });

  it("accepts valid sort values", () => {
    expect(normalizeReviewFilters({ sort: "asc" })).toEqual({ sort: "asc" });
    expect(normalizeReviewFilters({ sort: "desc" })).toEqual({ sort: "desc" });
  });
});

describe("toSignedAssetValue", () => {
  it("returns positive for non-liability types", () => {
    expect(toSignedAssetValue(1000, "cash")).toBe(1000);
    expect(toSignedAssetValue(1000, "property")).toBe(1000);
    expect(toSignedAssetValue(1000, "shares")).toBe(1000);
  });

  it("returns negative for liability types", () => {
    expect(toSignedAssetValue(1000, "liability")).toBe(-1000);
    expect(toSignedAssetValue(1000, "mortgage")).toBe(-1000);
  });

  it("normalizes sign — negative input for non-liability becomes positive", () => {
    expect(toSignedAssetValue(-500, "cash")).toBe(500);
  });

  it("normalizes sign — negative input for liability becomes negative", () => {
    expect(toSignedAssetValue(-500, "liability")).toBe(-500);
  });
});

describe("formatDirectionLabel", () => {
  it("returns 'Credit' when direction is 'credit'", () => {
    expect(formatDirectionLabel("credit")).toBe("Credit");
  });

  it("returns 'Debit' when direction is any non-credit string", () => {
    expect(formatDirectionLabel("debit")).toBe("Debit");
  });

  it("infers Debit from a negative amount when no direction given", () => {
    expect(formatDirectionLabel(undefined, "-50.00")).toBe("Debit");
  });

  it("infers Credit from a positive amount when no direction given", () => {
    expect(formatDirectionLabel(undefined, "50.00")).toBe("Credit");
  });

  it("returns 'Transaction' when neither direction nor amount given", () => {
    expect(formatDirectionLabel(undefined, undefined)).toBe("Transaction");
  });
});

describe("normalizeDateToISO", () => {
  it("converts DD/MM/YYYY to YYYY-MM-DD", () => {
    expect(normalizeDateToISO("15/01/2025")).toBe("2025-01-15");
  });

  it("converts DD-MM-YYYY to YYYY-MM-DD", () => {
    expect(normalizeDateToISO("15-03-2024")).toBe("2024-03-15");
  });

  it("converts DD.MM.YY to YYYY-MM-DD", () => {
    expect(normalizeDateToISO("05.06.24")).toBe("2024-06-05");
  });

  it("converts D/M/YYYY (single-digit day/month)", () => {
    expect(normalizeDateToISO("5/1/2025")).toBe("2025-01-05");
  });

  it("keeps ISO YYYY-MM-DD unchanged", () => {
    expect(normalizeDateToISO("2025-01-15")).toBe("2025-01-15");
  });

  it("returns empty string for empty input", () => {
    expect(normalizeDateToISO("")).toBe("");
  });

  it("returns original string for unparseable input", () => {
    expect(normalizeDateToISO("not-a-date")).toBe("not-a-date");
  });

  it("handles whitespace around the date", () => {
    expect(normalizeDateToISO("  15/01/2025  ")).toBe("2025-01-15");
  });

  it("all normalised dates sort chronologically as strings", () => {
    const inputs = [
      "31/01/2025",
      "01/02/2025",
      "15/01/2025",
      "2025-01-20",
      "01/01/2025",
      "2025-02-10",
    ];
    const normalised = inputs.map(normalizeDateToISO);
    const sorted = [...normalised].sort();
    expect(sorted).toEqual([
      "2025-01-01",
      "2025-01-15",
      "2025-01-20",
      "2025-01-31",
      "2025-02-01",
      "2025-02-10",
    ]);
  });

  it("CSV and PDF dates for the same day produce the same output", () => {
    const csv = normalizeDateToISO("15/01/2025");
    const pdf = normalizeDateToISO("2025-01-15");
    expect(csv).toBe(pdf);
    expect(csv).toBe("2025-01-15");
  });
});
