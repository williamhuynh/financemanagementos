import type { NavItem } from "./mockData";
import {
  assetCards,
  expenseTransactions,
  navItems,
  reportStats,
  spendByCategory,
  statCards
} from "./mockData";
import { getAppwriteClient } from "./appwriteClient";
import { Client, Databases, Query } from "node-appwrite";

const DEFAULT_WORKSPACE_ID = "default";
const DEFAULT_CATEGORIES = [
  "Income - Primary",
  "Income - Secondary",
  "Housing",
  "Transportation",
  "Groceries",
  "Food",
  "Utilities",
  "Medical, Healthcare & Fitness",
  "Savings, Investing, & Debt Payments",
  "Personal Spending",
  "Recreation & Entertainment",
  "Miscellaneous",
  "Work Expenses - Primary",
  "Work Expenses - Secondary",
  "Finance",
  "Parents Expenses",
  "Mortgage Repayments",
  "Transfer",
  "Uncategorised"
];
const TRANSFER_DAY_WINDOW = 10;
const TRANSFER_AMOUNT_TOLERANCE = 0.005;

type CardStat = {
  title: string;
  value: string;
  sub: string;
  tone?: string;
};

export type LedgerRow = {
  id: string;
  title: string;
  sub: string;
  category: string;
  amount: string;
  tone: string;
  isTransfer: boolean;
  isTransferMatched: boolean;
  chip?: string;
  highlight?: boolean;
};

export type ReviewItem = {
  id: string;
  title: string;
  sub: string;
  amount: string;
  category: string;
  actions: string[];
};

type AssetCard = {
  title: string;
  value: string;
  sub: string;
};

type ReportStat = {
  title: string;
  value: string;
  sub: string;
};

export type MonthOption = {
  value: string;
  label: string;
};

export type TransferTransaction = {
  id: string;
  description: string;
  date: string;
  accountName: string;
  amount: string;
  currency: string;
  debugReason?: string;
};

export type TransferSuggestion = {
  id: string;
  outflow: TransferTransaction;
  inflow: TransferTransaction;
  amountDiff: number;
  dateDiffDays: number;
};

export type TransferPairReview = {
  id: string;
  outflow: TransferTransaction;
  inflow: TransferTransaction;
  matchedAt: string;
};

export type TransferReviewData = {
  suggestions: TransferSuggestion[];
  unmatched: TransferTransaction[];
  paired: TransferPairReview[];
};

export type CategorySpend = {
  name: string;
  amount: number;
  formattedAmount: string;
  percent: number;
  count: number;
};

type CategorySpendBase = {
  name: string;
  amount: number;
  count: number;
};

export type ExpenseTransaction = {
  id: string;
  title: string;
  sub: string;
  amount: string;
  category: string;
  tone: "negative";
  dateValue: number;
};

export type ExpenseCategoryBreakdown = {
  name: string;
  amount: number;
  formattedAmount: string;
  percent: number;
  count: number;
  transactions: ExpenseTransaction[];
};

export type CashFlowStep = {
  label: string;
  value: number;
  formattedValue: string;
  kind: "income" | "expense" | "net";
};

export type CashFlowWaterfall = {
  monthOptions: MonthOption[];
  selectedMonth: string;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  steps: CashFlowStep[];
};

type ExpenseTransactionRaw = {
  id: string;
  description: string;
  date: string;
  accountName: string;
  amount: string;
  currency: string;
  direction: string;
  category: string;
};

type PreparedExpenseTransaction = ExpenseTransactionRaw & {
  dateValue: number;
  monthKey: string;
  amountValue: number | null;
};

type ServerAppwriteClient = {
  databases: Databases;
  databaseId: string;
};

async function listOrFallback<T>(collectionId: string, fallback: T[]) {
  const client = getAppwriteClient();

  if (!client) {
    return fallback;
  }

  try {
    const response = await client.databases.listDocuments(client.databaseId, collectionId);
    const documents = response?.documents ?? [];

    if (documents.length === 0) {
      return fallback;
    }

    return documents as T[];
  } catch (error) {
    return fallback;
  }
}

function getServerAppwrite() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT ?? process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId =
    process.env.APPWRITE_PROJECT_ID ?? process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const databaseId =
    process.env.APPWRITE_DATABASE_ID ?? process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!endpoint || !projectId || !databaseId || !apiKey) {
    return null;
  }

  const client = new Client();
  client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
  return { databases: new Databases(client), databaseId };
}

async function listTransferPairIds(
  serverClient: ServerAppwriteClient
): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset = 0;

  while (true) {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transfer_pairs",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.limit(100),
        Query.offset(offset)
      ]
    );
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      if (doc.from_transaction_id) {
        ids.add(String(doc.from_transaction_id));
      }
      if (doc.to_transaction_id) {
        ids.add(String(doc.to_transaction_id));
      }
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }

  return ids;
}

async function listTransferPairs(
  serverClient: ServerAppwriteClient
): Promise<TransferPairReview[]> {
  const pairs: TransferPairReview[] = [];
  let offset = 0;

  while (true) {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transfer_pairs",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("matched_at"),
        Query.limit(50),
        Query.offset(offset)
      ]
    );
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      const fromId = String(doc.from_transaction_id ?? "");
      const toId = String(doc.to_transaction_id ?? "");
      if (!fromId || !toId) {
        continue;
      }
      try {
        const [fromTxn, toTxn] = await Promise.all([
          serverClient.databases.getDocument(
            serverClient.databaseId,
            "transactions",
            fromId
          ),
          serverClient.databases.getDocument(
            serverClient.databaseId,
            "transactions",
            toId
          )
        ]);
        pairs.push({
          id: String(doc.$id ?? ""),
          matchedAt: String(doc.matched_at ?? ""),
          outflow: {
            id: String(fromTxn.$id ?? ""),
            description: String(fromTxn.description ?? "Transaction"),
            date: String(fromTxn.date ?? ""),
            accountName: String(fromTxn.account_name ?? "Unassigned"),
            amount: formatAmount(
              String(fromTxn.amount ?? ""),
              String(fromTxn.currency ?? "AUD")
            ),
            currency: String(fromTxn.currency ?? "AUD")
          },
          inflow: {
            id: String(toTxn.$id ?? ""),
            description: String(toTxn.description ?? "Transaction"),
            date: String(toTxn.date ?? ""),
            accountName: String(toTxn.account_name ?? "Unassigned"),
            amount: formatAmount(
              String(toTxn.amount ?? ""),
              String(toTxn.currency ?? "AUD")
            ),
            currency: String(toTxn.currency ?? "AUD")
          }
        });
      } catch (error) {
        continue;
      }
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }

  return pairs;
}

function formatAmount(value: string, currency = "AUD") {
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return value;
  }
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(numeric);
}

function formatCurrencyValue(amount: number, currency = "AUD") {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency
  }).format(amount);
}

function formatSignedCurrency(amount: number, currency = "AUD") {
  const sign = amount < 0 ? "-" : "+";
  return `${sign}${formatCurrencyValue(Math.abs(amount), currency)}`;
}

function formatDirectionLabel(direction?: string, amount?: string) {
  if (direction) {
    return direction === "credit" ? "Credit" : "Debit";
  }
  if (amount?.startsWith("-")) {
    return "Debit";
  }
  if (amount) {
    return "Credit";
  }
  return "Transaction";
}

function parseDateValue(value: string) {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  const match = trimmed.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    if (
      Number.isFinite(day) &&
      Number.isFinite(month) &&
      Number.isFinite(year)
    ) {
      const normalized = new Date(year, month - 1, day);
      if (!Number.isNaN(normalized.valueOf())) {
        return normalized;
      }
    }
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.valueOf())) {
    return parsed;
  }
  return null;
}

function getMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    month: "short",
    year: "numeric"
  }).format(date);
}

function parseAmountValue(value: string) {
  const numeric = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function getDateDiffDays(a: Date, b: Date) {
  const diff = Math.abs(a.valueOf() - b.valueOf());
  return diff / (1000 * 60 * 60 * 24);
}

function withinTransferTolerance(outflow: number, inflow: number) {
  if (outflow <= 0 || inflow <= 0) {
    return false;
  }
  const tolerance = outflow * TRANSFER_AMOUNT_TOLERANCE;
  return Math.abs(outflow - inflow) <= tolerance;
}

function buildSpendByCategory(items: CategorySpendBase[], currency = "AUD") {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  return items
    .filter((item) => item.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((item) => {
      const percent = total ? Math.round((item.amount / total) * 100) : 0;
      return {
        ...item,
        formattedAmount: formatAmount(item.amount.toFixed(2), currency),
        percent
      };
    });
}

function isTransferCategory(category: string) {
  return category.toLowerCase().includes("transfer");
}

function resolveMonthSelection(options: MonthOption[], selectedMonth?: string) {
  const current = getMonthKey(new Date());
  const optionValues = options.map((option) => option.value);
  const resolved = selectedMonth ?? (optionValues.includes(current) ? current : optionValues[0] ?? current);
  if (!optionValues.includes(resolved)) {
    options.push({
      value: resolved,
      label: getMonthLabel(new Date(`${resolved}-01`))
    });
  }
  return { options, selected: resolved };
}

function prepareTransactions(
  transactions: ExpenseTransactionRaw[],
  selectedMonth?: string
) {
  const monthMap = new Map<string, MonthOption>();
  const prepared: PreparedExpenseTransaction[] = [];

  for (const txn of transactions) {
    const parsedDate = parseDateValue(txn.date);
    if (!parsedDate) {
      continue;
    }
    const monthKey = getMonthKey(parsedDate);
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { value: monthKey, label: getMonthLabel(parsedDate) });
    }
    prepared.push({
      ...txn,
      dateValue: parsedDate.valueOf(),
      monthKey,
      amountValue: parseAmountValue(txn.amount)
    });
  }

  const monthOptions = Array.from(monthMap.values()).sort((a, b) =>
    b.value.localeCompare(a.value)
  );
  const { options, selected } = resolveMonthSelection(monthOptions, selectedMonth);

  return { prepared, monthOptions: options, selectedMonth: selected };
}

function buildExpenseBreakdown(
  transactions: ExpenseTransactionRaw[],
  selectedMonth?: string
) {
  const { prepared, monthOptions, selectedMonth: selected } = prepareTransactions(
    transactions,
    selectedMonth
  );

  const totals = new Map<string, ExpenseCategoryBreakdown>();
  let totalSpend = 0;

  for (const txn of prepared) {
    if (txn.monthKey !== selected) {
      continue;
    }
    const amountValue = txn.amountValue;
    if (amountValue === null) {
      continue;
    }
    const isDebit = txn.direction
      ? txn.direction !== "credit"
      : amountValue < 0;
    if (!isDebit) {
      continue;
    }

    const categoryName = txn.category.trim() || "Uncategorised";
    if (isTransferCategory(categoryName)) {
      continue;
    }

    const amount = Math.abs(amountValue);
    if (amount === 0) {
      continue;
    }

    totalSpend += amount;
    const formattedAmount = formatCurrencyValue(-amount, txn.currency || "AUD");
    const sub = [txn.date, txn.accountName].filter(Boolean).join(" - ");
    const transaction: ExpenseTransaction = {
      id: txn.id,
      title: txn.description || "Transaction",
      sub,
      amount: formattedAmount,
      category: categoryName,
      tone: "negative",
      dateValue: txn.dateValue
    };

    const existing = totals.get(categoryName);
    if (existing) {
      existing.amount += amount;
      existing.count += 1;
      existing.transactions.push(transaction);
    } else {
      totals.set(categoryName, {
        name: categoryName,
        amount,
        formattedAmount: formatCurrencyValue(amount, "AUD"),
        percent: 0,
        count: 1,
        transactions: [transaction]
      });
    }
  }

  const categories = Array.from(totals.values()).map((category) => {
    const percent = totalSpend ? Math.round((category.amount / totalSpend) * 100) : 0;
    category.percent = percent;
    category.formattedAmount = formatCurrencyValue(category.amount, "AUD");
    category.transactions.sort((a, b) => b.dateValue - a.dateValue);
    return category;
  });

  categories.sort((a, b) => b.amount - a.amount);

  return {
    monthOptions,
    selectedMonth: selected,
    totalAmount: totalSpend,
    totalFormatted: formatCurrencyValue(totalSpend, "AUD"),
    categories
  };
}

function buildCashFlowWaterfall(
  transactions: ExpenseTransactionRaw[],
  selectedMonth?: string
): CashFlowWaterfall {
  const { prepared, monthOptions, selectedMonth: selected } = prepareTransactions(
    transactions,
    selectedMonth
  );
  const categoryTotals = new Map<string, number>();
  let incomeTotal = 0;
  let expenseTotal = 0;

  for (const txn of prepared) {
    if (txn.monthKey !== selected) {
      continue;
    }
    const amountValue = txn.amountValue;
    if (amountValue === null) {
      continue;
    }
    const categoryName = txn.category.trim() || "Uncategorised";
    if (isTransferCategory(categoryName)) {
      continue;
    }
    const amount = Math.abs(amountValue);
    if (amount === 0) {
      continue;
    }
    const isCredit = txn.direction
      ? txn.direction === "credit"
      : amountValue > 0;
    if (isCredit) {
      incomeTotal += amount;
      continue;
    }
    expenseTotal += amount;
    categoryTotals.set(categoryName, (categoryTotals.get(categoryName) ?? 0) + amount);
  }

  const expenseSteps = Array.from(categoryTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({
      label,
      value: -amount,
      formattedValue: formatSignedCurrency(-amount, "AUD"),
      kind: "expense" as const
    }));

  const netTotal = incomeTotal - expenseTotal;

  return {
    monthOptions,
    selectedMonth: selected,
    incomeTotal,
    expenseTotal,
    netTotal,
    steps: [
      {
        label: "Income",
        value: incomeTotal,
        formattedValue: formatSignedCurrency(incomeTotal, "AUD"),
        kind: "income"
      },
      ...expenseSteps,
      {
        label: "Net",
        value: netTotal,
        formattedValue: formatSignedCurrency(netTotal, "AUD"),
        kind: "net"
      }
    ]
  };
}

export async function getNavItems(): Promise<NavItem[]> {
  return navItems;
}

export async function getCategories(): Promise<string[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return DEFAULT_CATEGORIES;
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "categories",
      [Query.equal("workspace_id", DEFAULT_WORKSPACE_ID), Query.orderAsc("name")]
    );
    const names = (response?.documents ?? [])
      .map((doc) => String(doc.name ?? "").trim())
      .filter(Boolean);
    const fallback = names.length ? names : DEFAULT_CATEGORIES;
    return fallback.includes("Transfer") ? fallback : [...fallback, "Transfer"];
  } catch (error) {
    return DEFAULT_CATEGORIES;
  }
}

export async function getStatCards(): Promise<CardStat[]> {
  return listOrFallback<CardStat>("dashboard_cards", statCards);
}

export async function getLedgerRows(): Promise<LedgerRow[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return [];
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("$createdAt"),
        Query.limit(50)
      ]
    );
    const documents = response?.documents ?? [];
    const transferPairIds = await listTransferPairIds(serverClient);

    if (documents.length === 0) {
      return [];
    }

    return documents.map((doc) => {
      const amount = String(doc.amount ?? "");
      const direction = String(doc.direction ?? "");
      const formattedAmount = formatAmount(
        amount,
        String(doc.currency ?? "AUD")
      );
      const category = String(doc.category_name ?? "Uncategorised");
      const needsReview = Boolean(doc.needs_review) || category === "Uncategorised";
      const tone =
        direction === "credit" || (!amount.startsWith("-") && amount !== "")
          ? "positive"
          : "negative";
      const label = formatDirectionLabel(direction, amount);
      const account = String(doc.account_name ?? "Unassigned");
      const sourceAccount = String(doc.source_account ?? "").trim();
      const date = String(doc.date ?? "");
      const sourceLabel =
        sourceAccount && sourceAccount !== account
          ? `Source: ${sourceAccount}`
          : "";

      return {
        id: String(doc.$id ?? ""),
        title: String(doc.description ?? "Transaction"),
        sub: [date, label, account, sourceLabel].filter(Boolean).join(" - "),
        category,
        amount: formattedAmount,
        tone,
        isTransfer: Boolean(doc.is_transfer),
        isTransferMatched: transferPairIds.has(String(doc.$id ?? "")),
        chip: needsReview ? "warn" : undefined,
        highlight: needsReview
      };
    });
  } catch (error) {
    return [];
  }
}

export async function getReviewItems(): Promise<ReviewItem[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return [];
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.or([
          Query.equal("needs_review", true),
          Query.equal("category_name", "Uncategorised")
        ]),
        Query.orderDesc("$createdAt"),
        Query.limit(12)
      ]
    );
    const documents = response?.documents ?? [];

    if (documents.length === 0) {
      return [];
    }

    return documents.map((doc) => {
      const amount = formatAmount(
        String(doc.amount ?? ""),
        String(doc.currency ?? "AUD")
      );
      const date = String(doc.date ?? "");
      const account = String(doc.account_name ?? "Unassigned");
      return {
        id: String(doc.$id ?? ""),
        title: String(doc.description ?? "Transaction"),
        sub: [date, account].filter(Boolean).join(" - "),
        amount,
        category: String(doc.category_name ?? "Uncategorised"),
        actions: ["Assign category", "Mark transfer", "Split"]
      };
    });
  } catch (error) {
    return [];
  }
}

export async function getTransferReviewData(): Promise<TransferReviewData> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return { suggestions: [], unmatched: [], paired: [] };
  }

  try {
    const transferPairIds = await listTransferPairIds(serverClient);
    const paired = await listTransferPairs(serverClient);
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.equal("is_transfer", true),
        Query.orderDesc("$createdAt"),
        Query.limit(200)
      ]
    );
    const documents = response?.documents ?? [];

    type TransferCandidate = TransferTransaction & {
      amountValue: number;
      dateValue: Date;
      isOutflow: boolean;
      isInflow: boolean;
    };

    const candidates = documents
      .map((doc) => {
        const id = String(doc.$id ?? "");
        if (!id || transferPairIds.has(id)) {
          return null;
        }
        const amountRaw = String(doc.amount ?? "");
        const amountValue = parseAmountValue(amountRaw);
        const dateValue = parseDateValue(String(doc.date ?? ""));
        if (amountValue === null || !dateValue) {
          return null;
        }
        const direction = String(doc.direction ?? "");
        const isOutflow = direction
          ? direction !== "credit"
          : amountValue < 0;
        const isInflow = direction
          ? direction === "credit"
          : amountValue > 0;
        if (!isOutflow && !isInflow) {
          return null;
        }
        const currency = String(doc.currency ?? "AUD");
        return {
          id,
          description: String(doc.description ?? "Transaction"),
          date: String(doc.date ?? ""),
          accountName: String(doc.account_name ?? "Unassigned"),
          amount: formatAmount(amountRaw, currency),
          currency,
          amountValue: Math.abs(amountValue),
          dateValue,
          isOutflow,
          isInflow
        };
      })
      .filter(Boolean) as TransferCandidate[];

    const outflows = candidates.filter((item) => item.isOutflow);
    const inflows = candidates.filter((item) => item.isInflow);
    const usedInflows = new Set<string>();
    const usedOutflows = new Set<string>();
    const suggestions: TransferSuggestion[] = [];

    for (const outflow of outflows) {
      const matches = inflows
        .filter((inflow) => !usedInflows.has(inflow.id))
        .map((inflow) => {
          const dateDiffDays = getDateDiffDays(outflow.dateValue, inflow.dateValue);
          if (dateDiffDays > TRANSFER_DAY_WINDOW) {
            return null;
          }
          if (!withinTransferTolerance(outflow.amountValue, inflow.amountValue)) {
            return null;
          }
          const amountDiff = Math.abs(outflow.amountValue - inflow.amountValue);
          return { inflow, dateDiffDays, amountDiff };
        })
        .filter(Boolean) as {
          inflow: TransferCandidate;
          dateDiffDays: number;
          amountDiff: number;
        }[];

      if (matches.length === 0) {
        continue;
      }

      matches.sort((a, b) => {
        if (a.dateDiffDays !== b.dateDiffDays) {
          return a.dateDiffDays - b.dateDiffDays;
        }
        return a.amountDiff - b.amountDiff;
      });

      const best = matches[0];
      usedInflows.add(best.inflow.id);
      usedOutflows.add(outflow.id);
      suggestions.push({
        id: `${outflow.id}-${best.inflow.id}`,
        outflow: outflow,
        inflow: best.inflow,
        amountDiff: best.amountDiff,
        dateDiffDays: Number(best.dateDiffDays.toFixed(2))
      });
    }

    const unmatched = candidates
      .filter((item) => !usedInflows.has(item.id) && !usedOutflows.has(item.id))
      .map((item) => ({
        id: item.id,
        description: item.description,
        date: item.date,
        accountName: item.accountName,
        amount: item.amount,
        currency: item.currency,
        debugReason: (() => {
          const isOutflow = item.isOutflow;
          const isInflow = item.isInflow;
          const counterparties = isOutflow ? inflows : outflows;
          if (counterparties.length === 0) {
            return isOutflow ? "No inflows marked as transfer" : "No outflows marked as transfer";
          }
          const withinWindow = counterparties.some(
            (candidate) =>
              getDateDiffDays(item.dateValue, candidate.dateValue) <=
              TRANSFER_DAY_WINDOW
          );
          if (!withinWindow) {
            return `No matches within ${TRANSFER_DAY_WINDOW} days`;
          }
          const withinAmount = counterparties.some((candidate) =>
            withinTransferTolerance(item.amountValue, candidate.amountValue)
          );
          if (!withinAmount) {
            return "No amount matches within 0.5% tolerance";
          }
          return "No eligible match";
        })()
      }));

    return { suggestions, unmatched, paired };
  } catch (error) {
    return { suggestions: [], unmatched: [], paired: [] };
  }
}

export async function getAssetCards(): Promise<AssetCard[]> {
  return listOrFallback<AssetCard>("asset_cards", assetCards);
}

export async function getReportStats(): Promise<ReportStat[]> {
  return listOrFallback<ReportStat>("report_stats", reportStats);
}

export async function getSpendByCategory(
  selectedMonth?: string
): Promise<CategorySpend[]> {
  const breakdown = await getExpenseBreakdown(selectedMonth);
  if (breakdown.categories.length === 0) {
    return buildSpendByCategory(spendByCategory);
  }
  return breakdown.categories.map((category) => ({
    name: category.name,
    amount: category.amount,
    formattedAmount: category.formattedAmount,
    percent: category.percent,
    count: category.count
  }));
}

export async function getExpenseBreakdown(selectedMonth?: string) {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return buildExpenseBreakdown(
      expenseTransactions.map((txn) => ({
        id: txn.id,
        description: txn.description,
        date: txn.date,
        accountName: txn.account_name,
        amount: txn.amount,
        currency: txn.currency,
        direction: txn.direction,
        category: txn.category_name
      })),
      selectedMonth
    );
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("$createdAt"),
        Query.limit(250)
      ]
    );
    const documents = response?.documents ?? [];
    const transferPairIds = await listTransferPairIds(serverClient);

    const transactions = documents.map((doc) => ({
      id: String(doc.$id ?? ""),
      description: String(doc.description ?? "Transaction"),
      date: String(doc.date ?? ""),
      accountName: String(doc.account_name ?? ""),
      amount: String(doc.amount ?? ""),
      currency: String(doc.currency ?? "AUD"),
      direction: String(doc.direction ?? ""),
      category: String(doc.category_name ?? "Uncategorised")
    }));

    const filteredTransactions = transactions.filter(
      (txn) => !transferPairIds.has(txn.id)
    );

    if (transactions.length === 0) {
      return buildExpenseBreakdown(
        expenseTransactions.map((txn) => ({
          id: txn.id,
          description: txn.description,
          date: txn.date,
          accountName: txn.account_name,
          amount: txn.amount,
          currency: txn.currency,
          direction: txn.direction,
          category: txn.category_name
        })),
        selectedMonth
      );
    }

    return buildExpenseBreakdown(filteredTransactions, selectedMonth);
  } catch (error) {
    return buildExpenseBreakdown(
      expenseTransactions.map((txn) => ({
        id: txn.id,
        description: txn.description,
        date: txn.date,
        accountName: txn.account_name,
        amount: txn.amount,
        currency: txn.currency,
        direction: txn.direction,
        category: txn.category_name
      })),
      selectedMonth
    );
  }
}

export async function getCashFlowWaterfall(
  selectedMonth?: string
): Promise<CashFlowWaterfall> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return buildCashFlowWaterfall(
      expenseTransactions.map((txn) => ({
        id: txn.id,
        description: txn.description,
        date: txn.date,
        accountName: txn.account_name,
        amount: txn.amount,
        currency: txn.currency,
        direction: txn.direction,
        category: txn.category_name
      })),
      selectedMonth
    );
  }

  try {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "transactions",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("$createdAt"),
        Query.limit(250)
      ]
    );
    const documents = response?.documents ?? [];
    const transferPairIds = await listTransferPairIds(serverClient);

    const transactions = documents.map((doc) => ({
      id: String(doc.$id ?? ""),
      description: String(doc.description ?? "Transaction"),
      date: String(doc.date ?? ""),
      accountName: String(doc.account_name ?? ""),
      amount: String(doc.amount ?? ""),
      currency: String(doc.currency ?? "AUD"),
      direction: String(doc.direction ?? ""),
      category: String(doc.category_name ?? "Uncategorised")
    }));

    const filteredTransactions = transactions.filter(
      (txn) => !transferPairIds.has(txn.id)
    );

    if (transactions.length === 0) {
      return buildCashFlowWaterfall(
        expenseTransactions.map((txn) => ({
          id: txn.id,
          description: txn.description,
          date: txn.date,
          accountName: txn.account_name,
          amount: txn.amount,
          currency: txn.currency,
          direction: txn.direction,
          category: txn.category_name
        })),
        selectedMonth
      );
    }

    return buildCashFlowWaterfall(filteredTransactions, selectedMonth);
  } catch (error) {
    return buildCashFlowWaterfall(
      expenseTransactions.map((txn) => ({
        id: txn.id,
        description: txn.description,
        date: txn.date,
        accountName: txn.account_name,
        amount: txn.amount,
        currency: txn.currency,
        direction: txn.direction,
        category: txn.category_name
      })),
      selectedMonth
    );
  }
}
