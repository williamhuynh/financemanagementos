import type { NavItem } from "./mockData";
import {
  assetCards,
  navItems,
  reportStats,
  spendByCategory
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
  "Travel & Holidays",
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
const DEFAULT_ASSET_CURRENCY = "AUD";
const DEFAULT_ASSET_DEFINITIONS: AssetDefinition[] = [
  {
    name: "Property",
    type: "property",
    label: "Property",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "glow"
  },
  {
    name: "Mortgage Liability",
    type: "liability",
    label: "Mortgage Liability",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "negative"
  },
  {
    name: "Other Liabilities",
    type: "other_liability",
    label: "Other Liabilities",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "negative"
  },
  {
    name: "Shares",
    type: "shares",
    label: "Shares",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "glow"
  },
  {
    name: "Managed Funds",
    type: "managed_fund",
    label: "Managed Funds",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "glow"
  },
  {
    name: "Superannuation",
    type: "superannuation",
    label: "Superannuation",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "glow"
  },
  {
    name: "Cash",
    type: "cash",
    label: "Cash",
    currency: DEFAULT_ASSET_CURRENCY,
    tone: "glow"
  }
];
const ASSET_TYPE_LABELS: Record<string, string> = {
  property: "Property",
  mortgage: "Mortgage Liability",
  liability: "Mortgage Liability",
  other_liability: "Other Liabilities",
  shares: "Shares",
  managed_fund: "Managed Funds",
  superannuation: "Superannuation",
  cash: "Cash"
};

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
  date?: string;
  account?: string;
  direction?: string;
  amountValue?: number | null;
};

export type LedgerFilterParams = {
  account?: string;
  category?: string;
  amount?: "inflow" | "outflow";
  month?: string;
  sort?: "asc" | "desc";
};

export type ReviewItem = {
  id: string;
  title: string;
  sub: string;
  amount: string;
  category: string;
  actions: string[];
  isTransfer: boolean;
  isTransferMatched: boolean;
  date?: string;
};

export type ReviewFilterParams = {
  account?: string;
  month?: string;
  sort?: "asc" | "desc";
};

type AssetCard = {
  title: string;
  value: string;
  sub: string;
};

export type AssetDefinition = {
  name: string;
  type: string;
  label: string;
  currency: string;
  tone?: "glow" | "negative";
};

export type AssetOwner = "William" | "Peggy" | "Joint";
export type AssetStatus = "active" | "disposed";

export type AssetEntity = {
  id: string;
  name: string;
  type: string;
  owner: AssetOwner;
  status: AssetStatus;
  currency: string;
  disposedAt?: string;
};

export type AssetCategorySummary = {
  type: string;
  label: string;
  totalValue: number | null;
  formattedValue: string;
  subLabel: string;
  tone?: "glow" | "negative";
};

export type AssetItem = {
  id: string;
  name: string;
  type: string;
  typeLabel: string;
  owner: AssetOwner;
  status: AssetStatus;
  currency: string;
  latestValue: number | null;
  latestValueAud: number | null;
  formattedValue: string;
  formattedAudValue: string;
  lastUpdatedLabel: string;
};

export type AssetHistoryEntry = {
  id: string;
  assetId?: string;
  name: string;
  type: string;
  typeLabel: string;
  currency: string;
  value: number;
  formattedValue: string;
  valueAud: number;
  formattedAudValue: string;
  recordedAt: string;
  recordedLabel: string;
  source?: string;
  notes?: string;
};

export type NetWorthPoint = {
  month: string;
  label: string;
  value: number;
  formattedValue: string;
};

export type AssetOverview = {
  categories: AssetCategorySummary[];
  assets: AssetItem[];
  disposedAssets: AssetItem[];
  history: AssetHistoryEntry[];
  netWorthSeries: NetWorthPoint[];
  assetSeries: Record<string, NetWorthPoint[]>;
  netWorth: number;
  netWorthFormatted: string;
  lastUpdatedLabel: string;
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

export type CashFlowTransaction = {
  id: string;
  title: string;
  sub: string;
  amount: string;
  tone: "positive" | "negative";
  dateValue: number;
};

export type CashFlowStep = {
  label: string;
  value: number;
  formattedValue: string;
  kind: "income" | "expense" | "net";
  transactions?: CashFlowTransaction[];
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

type AssetValueRecord = {
  id: string;
  asset_id?: string;
  asset_name: string;
  asset_type: string;
  value: string;
  currency: string;
  original_value?: string;
  original_currency?: string;
  value_aud?: string;
  fx_rate?: string;
  fx_source?: string;
  recorded_at: string;
  source?: string;
  notes?: string;
};

type AssetEntityRecord = {
  id: string;
  name: string;
  type: string;
  owner: AssetOwner;
  status: AssetStatus;
  currency: string;
  disposed_at?: string;
  deleted_at?: string;
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

async function listOrEmpty<T>(collectionId: string) {
  const client = getAppwriteClient();

  if (!client) {
    return [] as T[];
  }

  try {
    const response = await client.databases.listDocuments(client.databaseId, collectionId);
    return (response?.documents ?? []) as T[];
  } catch (error) {
    return [] as T[];
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

function normalizeAssetKey(value: string) {
  return value.trim().toLowerCase();
}

function isLiabilityAssetType(assetType: string) {
  const normalized = normalizeAssetKey(assetType);
  return normalized.includes("mortgage") || normalized.includes("liability");
}

function getAssetTypeLabel(assetType: string, assetName?: string) {
  const normalized = normalizeAssetKey(assetType);
  if (ASSET_TYPE_LABELS[normalized]) {
    return ASSET_TYPE_LABELS[normalized];
  }
  if (assetName) {
    return assetName;
  }
  return assetType || "Asset";
}

function toSignedAssetValue(value: number, assetType: string) {
  const normalized = Math.abs(value);
  return isLiabilityAssetType(assetType) ? -normalized : normalized;
}

function formatAssetValue(value: number, assetType: string, currency: string) {
  const signed = toSignedAssetValue(value, assetType);
  const formatted = formatCurrencyValue(Math.abs(signed), currency);
  return signed < 0 ? `-${formatted}` : formatted;
}

function formatNetWorth(value: number, currency: string) {
  const formatted = formatCurrencyValue(Math.abs(value), currency);
  return value < 0 ? `-${formatted}` : formatted;
}

function formatRecordedLabel(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return value;
  }
  return new Intl.DateTimeFormat("en-AU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(parsed);
}

function formatMonthLabelFromDate(value: string) {
  const parsed = parseDateValue(value);
  if (!parsed) {
    return "No updates yet";
  }
  return `Last update: ${getMonthLabel(parsed)}`;
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

function normalizeLedgerFilters(filters?: LedgerFilterParams) {
  if (!filters) {
    return {};
  }
  const normalized: LedgerFilterParams = {};
  if (filters.account && filters.account !== "all") {
    normalized.account = filters.account;
  }
  if (filters.category && filters.category !== "all") {
    normalized.category = filters.category;
  }
  if (filters.amount === "inflow" || filters.amount === "outflow") {
    normalized.amount = filters.amount;
  }
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    normalized.month = filters.month;
  }
  if (filters.sort === "asc" || filters.sort === "desc") {
    normalized.sort = filters.sort;
  }
  return normalized;
}

function normalizeReviewFilters(filters?: ReviewFilterParams) {
  if (!filters) {
    return {};
  }
  const normalized: ReviewFilterParams = {};
  if (filters.account && filters.account !== "all") {
    normalized.account = filters.account;
  }
  if (filters.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    normalized.month = filters.month;
  }
  if (filters.sort === "asc" || filters.sort === "desc") {
    normalized.sort = filters.sort;
  }
  return normalized;
}

function buildLedgerQueries(
  options?: LedgerFilterParams & { limit?: number; offset?: number }
) {
  const normalized = normalizeLedgerFilters(options);
  const sortDirection = normalized.sort === "desc" ? "desc" : "asc";
  const queries = [
    Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
    sortDirection === "desc" ? Query.orderDesc("date") : Query.orderAsc("date"),
    Query.orderDesc("$createdAt")
  ];

  if (normalized.account) {
    queries.push(Query.equal("account_name", normalized.account));
  }
  if (normalized.category) {
    queries.push(Query.equal("category_name", normalized.category));
  }
  if (normalized.amount === "inflow") {
    queries.push(Query.equal("direction", "credit"));
  }
  if (normalized.amount === "outflow") {
    queries.push(Query.equal("direction", "debit"));
  }
  if (typeof options?.limit === "number") {
    queries.push(Query.limit(options.limit));
  }
  if (typeof options?.offset === "number" && options.offset > 0) {
    queries.push(Query.offset(options.offset));
  }
  return queries;
}

function buildReviewQueries(
  options?: ReviewFilterParams & { limit?: number; offset?: number }
) {
  const normalized = normalizeReviewFilters(options);
  const sortDirection = normalized.sort === "desc" ? "desc" : "asc";
  const queries = [
    Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
    Query.or([
      Query.equal("needs_review", true),
      Query.equal("category_name", "Uncategorised")
    ]),
    sortDirection === "desc" ? Query.orderDesc("date") : Query.orderAsc("date"),
    Query.orderDesc("$createdAt")
  ];
  if (normalized.account) {
    queries.push(Query.equal("account_name", normalized.account));
  }
  if (typeof options?.limit === "number") {
    queries.push(Query.limit(options.limit));
  }
  if (typeof options?.offset === "number" && options.offset > 0) {
    queries.push(Query.offset(options.offset));
  }
  return queries;
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

function isIncomeCategory(category: string) {
  const normalized = category.trim().toLowerCase();
  return normalized === "income" || normalized.startsWith("income -");
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
  const expenseTransactionsByCategory = new Map<string, CashFlowTransaction[]>();
  const incomeTransactions: CashFlowTransaction[] = [];
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
    const isIncome = isIncomeCategory(categoryName);
    const isCredit = txn.direction
      ? txn.direction === "credit"
      : amountValue > 0;
    const signedAmount = isCredit ? amount : -amount;
    const sub = [txn.date, txn.accountName].filter(Boolean).join(" - ");
    const transaction: CashFlowTransaction = {
      id: txn.id,
      title: txn.description || "Transaction",
      sub,
      amount: formatSignedCurrency(signedAmount, txn.currency || "AUD"),
      tone: isCredit ? "positive" : "negative",
      dateValue: txn.dateValue
    };
    if (isIncome) {
      incomeTotal += signedAmount;
      incomeTransactions.push(transaction);
      continue;
    }
    expenseTotal += signedAmount;
    categoryTotals.set(
      categoryName,
      (categoryTotals.get(categoryName) ?? 0) + signedAmount
    );
    const expenseBucket = expenseTransactionsByCategory.get(categoryName) ?? [];
    expenseBucket.push(transaction);
    expenseTransactionsByCategory.set(categoryName, expenseBucket);
  }

  incomeTransactions.sort((a, b) => b.dateValue - a.dateValue);
  expenseTransactionsByCategory.forEach((items) =>
    items.sort((a, b) => b.dateValue - a.dateValue)
  );

  const expenseSteps = Array.from(categoryTotals.entries())
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([label, amount]) => ({
      label,
      value: amount,
      formattedValue: formatSignedCurrency(amount, "AUD"),
      kind: "expense" as const,
      transactions: expenseTransactionsByCategory.get(label) ?? []
    }));

  if (incomeTransactions.length === 0 && expenseSteps.length === 0) {
    return {
      monthOptions,
      selectedMonth: selected,
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
      steps: []
    };
  }

  const netTotal = incomeTotal + expenseTotal;

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
        kind: "income",
        transactions: incomeTransactions
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

function buildEmptyCashFlowWaterfall(selectedMonth?: string): CashFlowWaterfall {
  return {
    monthOptions: [],
    selectedMonth: selectedMonth ?? "",
    incomeTotal: 0,
    expenseTotal: 0,
    netTotal: 0,
    steps: []
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
  return listOrEmpty<CardStat>("dashboard_cards");
}

export async function getLedgerRows(
  options?: LedgerFilterParams & { limit?: number; offset?: number }
): Promise<LedgerRow[]> {
  const response = await getLedgerRowsWithTotal(options);
  return response.rows;
}

export async function getLedgerRowsWithTotal(
  options?: LedgerFilterParams & { limit?: number; offset?: number }
): Promise<{ rows: LedgerRow[]; total: number; hasMore: boolean }> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return { rows: [], total: 0, hasMore: false };
  }

  try {
    const limit =
      typeof options?.limit === "number" && options.limit > 0
        ? options.limit
        : 50;
    const offset =
      typeof options?.offset === "number" && options.offset > 0
        ? options.offset
        : 0;
    const normalizedFilters = normalizeLedgerFilters(options);
    const monthFilter = normalizedFilters.month;
    const transferPairIds = await listTransferPairIds(serverClient);
    const rows: LedgerRow[] = [];
    const batchSize = 100;
    let rawOffset = 0;
    let matchCount = 0;
    let total = 0;
    let hasMore = false;

    const matchesMonth = (value: string) => {
      if (!monthFilter) {
        return true;
      }
      const parsed = parseDateValue(value);
      if (!parsed) {
        return false;
      }
      return getMonthKey(parsed) === monthFilter;
    };

    while (true) {
      const response = await serverClient.databases.listDocuments(
        serverClient.databaseId,
        "transactions",
        buildLedgerQueries({
          ...normalizedFilters,
          limit: batchSize,
          offset: rawOffset
        })
      );
      const documents = response?.documents ?? [];
      if (documents.length === 0) {
        total = monthFilter ? matchCount : response?.total ?? matchCount;
        break;
      }

      for (const doc of documents) {
        const date = String(doc.date ?? "");
        if (!matchesMonth(date)) {
          continue;
        }
        matchCount += 1;
        if (matchCount <= offset) {
          continue;
        }
        if (rows.length >= limit) {
          hasMore = true;
          total = monthFilter ? matchCount : response?.total ?? matchCount;
          break;
        }
        const amount = String(doc.amount ?? "");
        const direction = String(doc.direction ?? "");
        const amountValue = parseAmountValue(amount);
        const formattedAmount = formatAmount(
          amount,
          String(doc.currency ?? "AUD")
        );
        const category = String(doc.category_name ?? "Uncategorised");
        const needsReview =
          Boolean(doc.needs_review) || category === "Uncategorised";
        const tone =
          direction === "credit" || (!amount.startsWith("-") && amount !== "")
            ? "positive"
            : "negative";
        const label = formatDirectionLabel(direction, amount);
        const account = String(doc.account_name ?? "Unassigned");
        const sourceAccount = String(doc.source_account ?? "").trim();
        const sourceLabel =
          sourceAccount && sourceAccount !== account
            ? `Source: ${sourceAccount}`
            : "";

        rows.push({
          id: String(doc.$id ?? ""),
          title: String(doc.description ?? "Transaction"),
          sub: [date, label, account, sourceLabel].filter(Boolean).join(" - "),
          category,
          amount: formattedAmount,
          tone,
          isTransfer: Boolean(doc.is_transfer),
          isTransferMatched: transferPairIds.has(String(doc.$id ?? "")),
          chip: needsReview ? "warn" : undefined,
          highlight: needsReview,
          date,
          account,
          direction,
          amountValue
        });
      }

      if (hasMore) {
        break;
      }
      rawOffset += documents.length;
      if (rawOffset >= (response?.total ?? 0)) {
        total = monthFilter ? matchCount : response?.total ?? matchCount;
        break;
      }
    }

    return { rows, total, hasMore };
  } catch (error) {
    return { rows: [], total: 0, hasMore: false };
  }
}

export async function getReviewItems(
  options?: ReviewFilterParams & { limit?: number }
): Promise<ReviewItem[]> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return [];
  }

  try {
    const transferPairIds = await listTransferPairIds(serverClient);
    const normalizedFilters = normalizeReviewFilters(options);
    const monthFilter = normalizedFilters.month;
    const sortDirection = normalizedFilters.sort === "desc" ? -1 : 1;
    const limit =
      typeof options?.limit === "number" && options.limit > 0
        ? options.limit
        : 50;
    const batchSize = 100;
    const items: ReviewItem[] = [];
    let offset = 0;

    const matchesMonth = (value: string) => {
      if (!monthFilter) {
        return true;
      }
      const parsed = parseDateValue(value);
      if (!parsed) {
        return false;
      }
      return getMonthKey(parsed) === monthFilter;
    };

    while (items.length < limit) {
      const response = await serverClient.databases.listDocuments(
        serverClient.databaseId,
        "transactions",
        buildReviewQueries({ ...normalizedFilters, limit: batchSize, offset })
      );
      const documents = response?.documents ?? [];
      if (documents.length === 0) {
        break;
      }
      for (const doc of documents) {
        const id = String(doc.$id ?? "");
        if (!id || transferPairIds.has(id)) {
          continue;
        }
        const date = String(doc.date ?? "");
        if (!matchesMonth(date)) {
          continue;
        }
        const amount = formatAmount(
          String(doc.amount ?? ""),
          String(doc.currency ?? "AUD")
        );
        const account = String(doc.account_name ?? "Unassigned");
        items.push({
          id,
          title: String(doc.description ?? "Transaction"),
          sub: [date, account].filter(Boolean).join(" - "),
          amount,
          category: String(doc.category_name ?? "Uncategorised"),
          actions: ["Assign category", "Mark transfer", "Split"],
          isTransfer: Boolean(doc.is_transfer),
          isTransferMatched: transferPairIds.has(id),
          date
        });
        if (items.length >= limit) {
          break;
        }
      }
      offset += documents.length;
      if (offset >= (response?.total ?? 0)) {
        break;
      }
    }

    return items.sort((a, b) => {
      const aValue = parseDateValue(a.date ?? "")?.valueOf();
      const bValue = parseDateValue(b.date ?? "")?.valueOf();
      const aSort =
        aValue ?? (sortDirection === 1 ? Number.MAX_SAFE_INTEGER : 0);
      const bSort =
        bValue ?? (sortDirection === 1 ? Number.MAX_SAFE_INTEGER : 0);
      if (aSort === bSort) {
        return 0;
      }
      return aSort < bSort ? -1 * sortDirection : 1 * sortDirection;
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

async function listAssetValueRecords(
  serverClient: ServerAppwriteClient
): Promise<AssetValueRecord[]> {
  const records: AssetValueRecord[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "asset_values",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderDesc("recorded_at"),
        Query.limit(limit),
        Query.offset(offset)
      ]
    );
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      if (String(doc.deleted_at ?? "").trim()) {
        continue;
      }
      records.push({
        id: String(doc.$id ?? ""),
        asset_id: String(doc.asset_id ?? ""),
        asset_name: String(doc.asset_name ?? ""),
        asset_type: String(doc.asset_type ?? ""),
        value: String(doc.value ?? ""),
        currency: String(doc.currency ?? DEFAULT_ASSET_CURRENCY),
        original_value: String(doc.original_value ?? ""),
        original_currency: String(doc.original_currency ?? ""),
        value_aud: String(doc.value_aud ?? ""),
        fx_rate: String(doc.fx_rate ?? ""),
        fx_source: String(doc.fx_source ?? ""),
        recorded_at: String(doc.recorded_at ?? ""),
        source: String(doc.source ?? ""),
        notes: String(doc.notes ?? "")
      });
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }

  return records;
}

async function listAssets(
  serverClient: ServerAppwriteClient
): Promise<AssetEntityRecord[]> {
  const assets: AssetEntityRecord[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const response = await serverClient.databases.listDocuments(
      serverClient.databaseId,
      "assets",
      [
        Query.equal("workspace_id", DEFAULT_WORKSPACE_ID),
        Query.orderAsc("name"),
        Query.limit(limit),
        Query.offset(offset)
      ]
    );
    const documents = response?.documents ?? [];
    for (const doc of documents) {
      if (String(doc.deleted_at ?? "").trim()) {
        continue;
      }
      assets.push({
        id: String(doc.$id ?? ""),
        name: String(doc.name ?? ""),
        type: String(doc.type ?? ""),
        owner: normalizeOwner(String(doc.owner ?? "")),
        status: normalizeStatus(String(doc.status ?? "")),
        currency: String(doc.currency ?? DEFAULT_ASSET_CURRENCY),
        disposed_at: String(doc.disposed_at ?? ""),
        deleted_at: String(doc.deleted_at ?? "")
      });
    }
    offset += documents.length;
    if (documents.length === 0 || offset >= (response?.total ?? 0)) {
      break;
    }
  }

  return assets;
}

type PreparedAssetRecord = {
  id: string;
  assetId: string;
  name: string;
  type: string;
  owner: AssetOwner;
  status: AssetStatus;
  currency: string;
  valueOriginal: number;
  valueAud: number;
  recordedAt: string;
  dateValue: number;
  monthKey: string;
  disposedAt?: string;
  fxRate?: number;
  source?: string;
  notes?: string;
};

function normalizeOwner(value: string): AssetOwner {
  if (value === "William" || value === "Peggy" || value === "Joint") {
    return value;
  }
  return "Joint";
}

function normalizeStatus(value: string): AssetStatus {
  return value === "disposed" ? "disposed" : "active";
}

function getDisposedMonthKey(value?: string) {
  if (!value) {
    return null;
  }
  const parsed = parseDateValue(value);
  if (!parsed) {
    return null;
  }
  return getMonthKey(parsed);
}

function prepareAssetRecords(
  records: AssetValueRecord[],
  assetsById: Map<string, AssetEntityRecord>
) {
  const prepared: PreparedAssetRecord[] = [];
  for (const record of records) {
    const parsedOriginal =
      parseAmountValue(record.original_value ?? record.value) ?? null;
    const parsedAud =
      parseAmountValue(record.value_aud ?? "") ??
      (parsedOriginal !== null ? parsedOriginal : null);
    const parsedDate = parseDateValue(record.recorded_at);
    if (parsedOriginal === null || parsedAud === null || !parsedDate) {
      continue;
    }
    const assetId = record.asset_id?.trim() || "";
    const linkedAsset = assetId ? assetsById.get(assetId) : undefined;
    const name =
      linkedAsset?.name?.trim() ||
      record.asset_name?.trim() ||
      getAssetTypeLabel(record.asset_type);
    const type = linkedAsset?.type?.trim() || record.asset_type?.trim() || "asset";
    const currency =
      linkedAsset?.currency?.trim() ||
      record.original_currency?.trim() ||
      record.currency?.trim() ||
      DEFAULT_ASSET_CURRENCY;
    const monthKey = getMonthKey(parsedDate);
    prepared.push({
      id: record.id,
      assetId: linkedAsset?.id || assetId || normalizeAssetKey(name),
      name,
      type,
      owner: linkedAsset?.owner ?? "Joint",
      status: linkedAsset?.status ?? "active",
      currency,
      valueOriginal: Math.abs(parsedOriginal),
      valueAud: Math.abs(parsedAud),
      recordedAt: record.recorded_at,
      dateValue: parsedDate.valueOf(),
      monthKey,
      disposedAt: linkedAsset?.disposed_at || undefined,
      fxRate: parseAmountValue(record.fx_rate ?? "") ?? undefined,
      source: record.source?.trim() || undefined,
      notes: record.notes?.trim() || undefined
    });
  }
  return prepared;
}

function buildNetWorthSeries(
  records: PreparedAssetRecord[],
  disposedByAsset: Map<string, string | null>
) {
  if (records.length === 0) {
    return [];
  }
  const byMonth = new Map<string, PreparedAssetRecord[]>();
  for (const record of records) {
    const entries = byMonth.get(record.monthKey) ?? [];
    entries.push(record);
    byMonth.set(record.monthKey, entries);
  }

  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => a.localeCompare(b));
  const currentByAsset = new Map<string, PreparedAssetRecord>();
  const series: NetWorthPoint[] = [];

  for (const monthKey of monthKeys) {
    const entries = byMonth.get(monthKey) ?? [];
    for (const entry of entries) {
      currentByAsset.set(entry.assetId, entry);
    }
    for (const [assetId, disposedMonth] of disposedByAsset.entries()) {
      if (disposedMonth && monthKey >= disposedMonth) {
        currentByAsset.delete(assetId);
      }
    }
    let total = 0;
    for (const entry of currentByAsset.values()) {
      total += toSignedAssetValue(entry.valueAud, entry.type);
    }
    series.push({
      month: monthKey,
      label: getMonthLabel(new Date(`${monthKey}-01`)),
      value: total,
      formattedValue: formatNetWorth(total, DEFAULT_ASSET_CURRENCY)
    });
  }

  return series;
}

function buildAssetSeries(
  records: PreparedAssetRecord[],
  definitions: AssetDefinition[],
  disposedByAsset: Map<string, string | null>
) {
  if (records.length === 0) {
    return {};
  }
  const byMonth = new Map<string, PreparedAssetRecord[]>();
  for (const record of records) {
    const entries = byMonth.get(record.monthKey) ?? [];
    entries.push(record);
    byMonth.set(record.monthKey, entries);
  }

  const monthKeys = Array.from(byMonth.keys()).sort((a, b) => a.localeCompare(b));
  const currentByAsset = new Map<string, PreparedAssetRecord>();
  const seriesMap: Record<string, NetWorthPoint[]> = {};
  const definitionMap = new Map<string, AssetDefinition>();

  for (const definition of definitions) {
    definitionMap.set(normalizeAssetKey(definition.type), definition);
  }

  for (const monthKey of monthKeys) {
    const entries = byMonth.get(monthKey) ?? [];
    for (const entry of entries) {
      currentByAsset.set(entry.assetId, entry);
    }
    for (const [assetId, disposedMonth] of disposedByAsset.entries()) {
      if (disposedMonth && monthKey >= disposedMonth) {
        currentByAsset.delete(assetId);
      }
    }
    for (const [assetId, entry] of currentByAsset.entries()) {
      const definition = definitionMap.get(normalizeAssetKey(entry.type)) ?? {
        name: entry.name,
        type: entry.type,
        label: entry.name,
        currency: entry.currency
      };
      if (!seriesMap[assetId]) {
        seriesMap[assetId] = [];
      }
      const signedValue = toSignedAssetValue(entry.valueAud, entry.type);
      seriesMap[assetId].push({
        month: monthKey,
        label: getMonthLabel(new Date(`${monthKey}-01`)),
        value: signedValue,
        formattedValue: formatNetWorth(signedValue, definition.currency)
      });
    }
  }

  return seriesMap;
}

function buildAssetOverviewFromRecords(
  records: AssetValueRecord[],
  assetEntities: AssetEntityRecord[],
  definitions: AssetDefinition[] = DEFAULT_ASSET_DEFINITIONS
): AssetOverview {
  const assetsById = new Map<string, AssetEntityRecord>();
  assetEntities.forEach((asset) => {
    assetsById.set(asset.id, asset);
  });

  const prepared = prepareAssetRecords(records, assetsById);
  let normalizedAssets = assetEntities;

  if (normalizedAssets.length === 0) {
    const syntheticAssets = new Map<string, AssetEntityRecord>();
    for (const record of prepared) {
      if (syntheticAssets.has(record.assetId)) {
        continue;
      }
      syntheticAssets.set(record.assetId, {
        id: record.assetId,
        name: record.name,
        type: record.type,
        owner: record.owner,
        status: record.status,
        currency: record.currency
      });
    }
    normalizedAssets = Array.from(syntheticAssets.values());
  }

  const definitionMap = new Map<string, AssetDefinition>();
  const categoryDefinitions: AssetDefinition[] = [];
  for (const definition of definitions) {
    definitionMap.set(normalizeAssetKey(definition.type), definition);
    categoryDefinitions.push(definition);
  }
  for (const asset of normalizedAssets) {
    const key = normalizeAssetKey(asset.type);
    if (definitionMap.has(key)) {
      continue;
    }
    const next: AssetDefinition = {
      name: asset.name,
      type: asset.type,
      label: getAssetTypeLabel(asset.type, asset.name),
      currency: asset.currency,
      tone: isLiabilityAssetType(asset.type) ? "negative" : "glow"
    };
    definitionMap.set(key, next);
    categoryDefinitions.push(next);
  }

  const latestByAsset = new Map<string, PreparedAssetRecord>();
  for (const record of prepared) {
    const current = latestByAsset.get(record.assetId);
    if (!current || record.dateValue > current.dateValue) {
      latestByAsset.set(record.assetId, record);
    }
  }

  const assetItems = normalizedAssets.map((asset) => {
    const latest = latestByAsset.get(asset.id);
    const value = latest ? latest.valueOriginal : null;
    const valueAud = latest ? latest.valueAud : null;
    return {
      id: asset.id,
      name: asset.name,
      type: asset.type,
      typeLabel: getAssetTypeLabel(asset.type, asset.name),
      owner: asset.owner,
      status: asset.status,
      currency: asset.currency,
      latestValue: value,
      latestValueAud: valueAud,
      formattedValue:
        value === null
          ? "--"
          : formatAssetValue(value, asset.type, asset.currency),
      formattedAudValue:
        valueAud === null
          ? "--"
          : formatNetWorth(toSignedAssetValue(valueAud, asset.type), DEFAULT_ASSET_CURRENCY),
      lastUpdatedLabel: latest
        ? formatRecordedLabel(latest.recordedAt)
        : "No updates yet"
    };
  });

  const assets = assetItems.filter((asset) => asset.status === "active");
  const disposedAssets = assetItems.filter((asset) => asset.status === "disposed");

  const disposedByAsset = new Map<string, string | null>();
  normalizedAssets.forEach((asset) => {
    disposedByAsset.set(asset.id, getDisposedMonthKey(asset.disposed_at));
  });

  const categories: AssetCategorySummary[] = categoryDefinitions.map((definition) => {
    const items = assets.filter((asset) => asset.type === definition.type);
    if (items.length === 0) {
      return {
        type: definition.type,
        label: definition.label,
        totalValue: null,
        formattedValue: "--",
        subLabel: "No assets yet",
        tone: isLiabilityAssetType(definition.type) ? "negative" : definition.tone
      };
    }

    const latestDates = items
      .map((asset) => {
        const latest = latestByAsset.get(asset.id);
        return latest?.recordedAt ?? "";
      })
      .filter(Boolean);
    const latestDate =
      latestDates.length > 0 ? latestDates.sort().slice(-1)[0] : "";
    const total = items.reduce((sum, asset) => {
      const latest = latestByAsset.get(asset.id);
      if (!latest) {
        return sum;
      }
      return sum + toSignedAssetValue(latest.valueAud, asset.type);
    }, 0);

    return {
      type: definition.type,
      label: definition.label,
      totalValue: total,
      formattedValue: formatNetWorth(total, DEFAULT_ASSET_CURRENCY),
      subLabel: latestDate ? formatMonthLabelFromDate(latestDate) : "No updates yet",
      tone: isLiabilityAssetType(definition.type) ? "negative" : definition.tone
    };
  });

  const history = prepared
    .sort((a, b) => b.dateValue - a.dateValue)
    .map((record) => ({
      id: record.id,
      assetId: record.assetId,
      name: record.name,
      type: record.type,
      typeLabel: getAssetTypeLabel(record.type, record.name),
      currency: record.currency,
      value: record.valueOriginal,
      formattedValue: formatAssetValue(
        record.valueOriginal,
        record.type,
        record.currency
      ),
      valueAud: record.valueAud,
      formattedAudValue: formatNetWorth(
        toSignedAssetValue(record.valueAud, record.type),
        DEFAULT_ASSET_CURRENCY
      ),
      recordedAt: record.recordedAt,
      recordedLabel: formatRecordedLabel(record.recordedAt),
      source: record.source,
      notes: record.notes
    }));

  const netWorth = assets.reduce((sum, asset) => {
    const latest = latestByAsset.get(asset.id);
    if (!latest) {
      return sum;
    }
    return sum + toSignedAssetValue(latest.valueAud, asset.type);
  }, 0);

  const netWorthSeries = buildNetWorthSeries(prepared, disposedByAsset);
  const assetSeries = buildAssetSeries(prepared, categoryDefinitions, disposedByAsset);

  const lastUpdated =
    prepared.length > 0
      ? prepared.reduce((latest, record) =>
          record.dateValue > latest.dateValue ? record : latest
        ).recordedAt
      : "";

  return {
    categories,
    assets,
    disposedAssets,
    history,
    netWorthSeries,
    assetSeries,
    netWorth,
    netWorthFormatted: formatNetWorth(netWorth, DEFAULT_ASSET_CURRENCY),
    lastUpdatedLabel: lastUpdated ? formatRecordedLabel(lastUpdated) : "No updates yet"
  };
}

export async function getAssetCards(): Promise<AssetCard[]> {
  return listOrFallback<AssetCard>("asset_cards", assetCards);
}

export async function getAssetOverview(): Promise<AssetOverview> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return buildAssetOverviewFromRecords([], []);
  }

  try {
    const [records, assets] = await Promise.all([
      listAssetValueRecords(serverClient),
      listAssets(serverClient)
    ]);
    return buildAssetOverviewFromRecords(records, assets);
  } catch (error) {
    return buildAssetOverviewFromRecords([], []);
  }
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
    return buildExpenseBreakdown([], selectedMonth);
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
      return buildExpenseBreakdown([], selectedMonth);
    }

    return buildExpenseBreakdown(filteredTransactions, selectedMonth);
  } catch (error) {
    return buildExpenseBreakdown([], selectedMonth);
  }
}

export async function getCashFlowWaterfall(
  selectedMonth?: string
): Promise<CashFlowWaterfall> {
  const serverClient = getServerAppwrite();
  if (!serverClient) {
    return buildEmptyCashFlowWaterfall(selectedMonth);
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
      return buildEmptyCashFlowWaterfall(selectedMonth);
    }

    return buildCashFlowWaterfall(filteredTransactions, selectedMonth);
  } catch (error) {
    return buildEmptyCashFlowWaterfall(selectedMonth);
  }
}
