export type CategoryGroup = "income" | "expense" | null;

export type DefaultCategory = {
  readonly name: string;
  readonly group: CategoryGroup;
};

export const DEFAULT_CATEGORIES: readonly DefaultCategory[] = [
  { name: "Income - Primary", group: "income" },
  { name: "Income - Secondary", group: "income" },
  { name: "Housing", group: "expense" },
  { name: "Transportation", group: "expense" },
  { name: "Groceries", group: "expense" },
  { name: "Food", group: "expense" },
  { name: "Utilities", group: "expense" },
  { name: "Medical, Healthcare & Fitness", group: "expense" },
  { name: "Savings, Investing, & Debt Payments", group: "expense" },
  { name: "Personal Spending", group: "expense" },
  { name: "Recreation & Entertainment", group: "expense" },
  { name: "Travel & Holidays", group: "expense" },
  { name: "Miscellaneous", group: "expense" },
  { name: "Work Expenses - Primary", group: "expense" },
  { name: "Work Expenses - Secondary", group: "expense" },
  { name: "Finance", group: "expense" },
  { name: "Parents Expenses", group: "expense" },
  { name: "Mortgage Repayments", group: "expense" },
  { name: "Transfer", group: null },
  { name: "Uncategorised", group: null },
] as const;

export const DEFAULT_CATEGORY_NAMES: string[] = DEFAULT_CATEGORIES.map(c => c.name);

export const SYSTEM_CATEGORIES = ["Transfer", "Uncategorised"] as const;

export type SystemCategoryName = typeof SYSTEM_CATEGORIES[number];

export function isSystemCategory(name: string): boolean {
  return SYSTEM_CATEGORIES.some(
    sc => sc.toLowerCase() === name.trim().toLowerCase()
  );
}
