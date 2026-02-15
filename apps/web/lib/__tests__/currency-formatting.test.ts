import { describe, it, expect } from "vitest";
import {
  formatCurrencyValue,
  maskCurrencyValue,
  buildExpenseBreakdown,
  buildCashFlowWaterfall,
} from "../data";

describe("formatCurrencyValue with all 5 currencies", () => {
  it("formats AUD correctly", () => {
    const result = formatCurrencyValue(1234.56, "AUD");
    expect(result).toContain("$");
    expect(result).toContain("1,234.56");
  });

  it("formats USD correctly", () => {
    const result = formatCurrencyValue(1234.56, "USD");
    expect(result).toContain("$");
    expect(result).toContain("1,234.56");
  });

  it("formats GBP correctly", () => {
    const result = formatCurrencyValue(1234.56, "GBP");
    expect(result).toContain("£");
    expect(result).toContain("1,234.56");
  });

  it("formats NZD correctly", () => {
    const result = formatCurrencyValue(1234.56, "NZD");
    expect(result).toContain("$");
    expect(result).toContain("1,234.56");
  });

  it("formats EUR correctly", () => {
    const result = formatCurrencyValue(1234.56, "EUR");
    expect(result).toContain("€");
    expect(result).toContain("1,234.56");
  });
});

describe("formatCurrencyValue edge cases", () => {
  it("formats zero correctly", () => {
    const result = formatCurrencyValue(0, "GBP");
    expect(result).toContain("£");
    expect(result).toContain("0.00");
  });

  it("formats negative amounts", () => {
    const result = formatCurrencyValue(-500, "EUR");
    expect(result).toContain("€");
    expect(result).toContain("500.00");
  });

  it("formats large numbers with commas", () => {
    const result = formatCurrencyValue(1000000, "USD");
    expect(result).toContain("$");
    expect(result).toContain("1,000,000.00");
  });
});

describe("maskCurrencyValue with all symbol types", () => {
  it("masks $ correctly (existing behavior)", () => {
    expect(maskCurrencyValue("$1,234.56", false)).toBe("$12***");
  });

  it("masks negative $ correctly", () => {
    expect(maskCurrencyValue("-$500.00", false)).toBe("-$50***");
  });

  it("masks £ correctly (new — validates regex fix)", () => {
    expect(maskCurrencyValue("£1,234.56", false)).toBe("£12***");
  });

  it("masks € correctly (new — validates regex fix)", () => {
    expect(maskCurrencyValue("€1,234.56", false)).toBe("€12***");
  });

  it("masks 3-letter currency code correctly", () => {
    expect(maskCurrencyValue("NZD 1,234.56", false)).toBe("NZD12***");
  });

  it("returns unmasked value when visible", () => {
    expect(maskCurrencyValue("£1,234.56", true)).toBe("£1,234.56");
  });
});

describe("buildExpenseBreakdown with GBP home currency", () => {
  const mockTransactions = [
    {
      id: "1",
      description: "Coffee",
      date: "2025-01-15",
      accountName: "Cash",
      amount: "-5.00",
      currency: "GBP",
      direction: "debit",
      category: "Food",
    },
    {
      id: "2",
      description: "Groceries",
      date: "2025-01-16",
      accountName: "Cash",
      amount: "-50.00",
      currency: "GBP",
      direction: "debit",
      category: "Food",
    },
  ];

  it("formats totals with £", () => {
    const result = buildExpenseBreakdown(mockTransactions, "GBP", "2025-01");
    expect(result.totalFormatted).toContain("£");
  });

  it("formats category amounts with £", () => {
    const result = buildExpenseBreakdown(mockTransactions, "GBP", "2025-01");
    for (const category of result.categories) {
      expect(category.formattedAmount).toContain("£");
    }
  });
});

describe("buildExpenseBreakdown with EUR home currency", () => {
  const mockTransactions = [
    {
      id: "1",
      description: "Lunch",
      date: "2025-01-15",
      accountName: "Cash",
      amount: "-12.50",
      currency: "EUR",
      direction: "debit",
      category: "Food",
    },
  ];

  it("formats totals with €", () => {
    const result = buildExpenseBreakdown(mockTransactions, "EUR", "2025-01");
    expect(result.totalFormatted).toContain("€");
  });
});

describe("buildCashFlowWaterfall with GBP home currency", () => {
  const mockTransactions = [
    {
      id: "1",
      description: "Salary",
      date: "2025-01-15",
      accountName: "Bank",
      amount: "3000.00",
      currency: "GBP",
      direction: "credit",
      category: "Income",
    },
    {
      id: "2",
      description: "Rent",
      date: "2025-01-16",
      accountName: "Bank",
      amount: "-1000.00",
      currency: "GBP",
      direction: "debit",
      category: "Housing",
    },
  ];

  it("formats income/expense/net steps with £", () => {
    const result = buildCashFlowWaterfall(mockTransactions, "GBP", "2025-01");
    for (const step of result.steps) {
      expect(step.formattedValue).toContain("£");
    }
  });
});

describe("buildCashFlowWaterfall with mixed transaction currencies", () => {
  const mockTransactions = [
    {
      id: "1",
      description: "Salary",
      date: "2025-01-15",
      accountName: "Bank",
      amount: "3000.00",
      currency: "USD",
      direction: "credit",
      category: "Income",
    },
    {
      id: "2",
      description: "Rent",
      date: "2025-01-16",
      accountName: "Bank",
      amount: "-1000.00",
      currency: "USD",
      direction: "debit",
      category: "Housing",
    },
  ];

  it("formats individual transaction amounts with transaction currency ($)", () => {
    const result = buildCashFlowWaterfall(mockTransactions, "GBP", "2025-01");
    // Individual transactions should use their own currency (USD = $)
    for (const step of result.steps) {
      if (step.transactions) {
        for (const txn of step.transactions) {
          expect(txn.amount).toContain("$");
        }
      }
    }
  });

  it("formats summary steps (Income/Net) with home currency (£)", () => {
    const result = buildCashFlowWaterfall(mockTransactions, "GBP", "2025-01");
    const summarySteps = result.steps.filter(
      (s: any) => s.kind === "income" || s.kind === "net"
    );
    for (const step of summarySteps) {
      expect(step.formattedValue).toContain("£");
    }
  });
});
