export type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: string;
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { id: "cash", label: "Cash Log", href: "/cash", icon: "cash" },
  { id: "ledger", label: "Transactions", href: "/ledger", icon: "ledger" },
  { id: "review", label: "Review Queue", href: "/review", icon: "review" },
  { id: "assets", label: "Assets", href: "/assets", icon: "assets" },
  { id: "reports", label: "Reports", href: "/reports", icon: "reports" },
  { id: "import", label: "Import Hub", href: "/import-hub", icon: "import" },
  { id: "settings", label: "Settings", href: "/settings", icon: "settings" }
];

export const statCards = [
  { title: "Cash", value: "$10,000", sub: "+1.1% MoM", tone: "glow" },
  { title: "Investments", value: "$50,000", sub: "+3.4% MoM", tone: "glow" },
  { title: "Property", value: "$500,000", sub: "Stable", tone: "glow" },
  { title: "Liabilities", value: "$350,000", sub: "Mortgage + credit", tone: "negative" }
];

export const ledgerRows = [
  {
    title: "Double Dose Croydon",
    sub: "26 Aug 2024 - Credit - Westpac",
    category: "Food",
    amount: "-$5.58",
    tone: "negative"
  },
  {
    title: "Superloop",
    sub: "29 Jul 2024 - Savings - Westpac Offset",
    category: "Utilities",
    amount: "-$85.00",
    tone: "negative"
  },
  {
    title: "OSKO Payment - Transfer",
    sub: "31 Jul 2024 - Savings - Westpac Offset",
    category: "Transfer",
    amount: "$133.90",
    tone: "positive",
    chip: "neutral"
  },
  {
    title: "Amber Electric",
    sub: "11 Jul 2024 - Savings - Westpac Offset",
    category: "Needs review",
    amount: "-$150.61",
    tone: "negative",
    chip: "warn",
    highlight: true
  }
];

export const reviewItems = [
  {
    title: "Hitting Targets Pty Ltd",
    sub: "9 Aug 2024 - Savings - Westpac Offset",
    amount: "-$500.00",
    actions: ["Recreation", "Personal", "Split"]
  },
  {
    title: "Westpac Bankcorp Direct",
    sub: "10 Jul 2024 - Savings - Westpac Offset",
    amount: "-$8,580.00",
    actions: ["Mortgage", "Mark transfer"]
  },
  {
    title: "OSKO Mobile",
    sub: "1 Jul 2024 - Savings - Westpac Offset",
    amount: "-$3,557.60",
    actions: ["Bank transfer", "Pair"]
  }
];

export const assetCards = [
  { title: "Property", value: "$500,000", sub: "Last update: Mar 2025" },
  { title: "Stocks", value: "$25,000", sub: "Broker" },
  { title: "Managed Funds", value: "$10,000", sub: "Index Fund" },
  { title: "Superannuation", value: "$45,000", sub: "Super Fund" }
];



export const reportStats = [
  { title: "Income", value: "$19,398", sub: "Primary + secondary" },
  { title: "Expenses", value: "$8,580", sub: "All categories" },
  { title: "Transfers Excluded", value: "$3,559", sub: "Matched pairs" }        
];

export const spendByCategory = [
  { name: "Housing", amount: 2480, count: 4 },
  { name: "Transportation", amount: 1320, count: 12 },
  { name: "Groceries", amount: 890, count: 18 },
  { name: "Utilities", amount: 640, count: 6 },
  { name: "Medical, Healthcare & Fitness", amount: 420, count: 5 },
  { name: "Personal Spending", amount: 380, count: 9 },
  { name: "Recreation & Entertainment", amount: 310, count: 7 }
];

export const expenseTransactions = [
  {
    id: "txn-01",
    description: "Rent - Park Lane",
    date: "2024-08-03",
    account_name: "Westpac Offset",
    amount: "-2150.00",
    currency: "AUD",
    direction: "debit",
    category_name: "Housing"
  },
  {
    id: "txn-02",
    description: "Coles Sydney",
    date: "2024-08-05",
    account_name: "Westpac Debit",
    amount: "-132.45",
    currency: "AUD",
    direction: "debit",
    category_name: "Groceries"
  },
  {
    id: "txn-03",
    description: "Opal top-up",
    date: "2024-08-06",
    account_name: "Westpac Debit",
    amount: "-45.00",
    currency: "AUD",
    direction: "debit",
    category_name: "Transportation"
  },
  {
    id: "txn-04",
    description: "GAS - Red Energy",
    date: "2024-08-08",
    account_name: "Westpac Offset",
    amount: "-210.60",
    currency: "AUD",
    direction: "debit",
    category_name: "Utilities"
  },
  {
    id: "txn-04b",
    description: "Monthly Salary",
    date: "2024-08-08",
    account_name: "Westpac Offset",
    amount: "8200.00",
    currency: "AUD",
    direction: "credit",
    category_name: "Income - Primary"
  },
  {
    id: "txn-04c",
    description: "Side Contract",
    date: "2024-08-10",
    account_name: "Westpac Offset",
    amount: "1150.00",
    currency: "AUD",
    direction: "credit",
    category_name: "Income - Secondary"
  },
  {
    id: "txn-04d",
    description: "Savings Transfer",
    date: "2024-08-11",
    account_name: "Westpac Offset",
    amount: "900.00",
    currency: "AUD",
    direction: "credit",
    category_name: "Transfer"
  },
  {
    id: "txn-05",
    description: "Anytime Fitness",
    date: "2024-07-22",
    account_name: "Westpac Debit",
    amount: "-62.00",
    currency: "AUD",
    direction: "debit",
    category_name: "Medical, Healthcare & Fitness"
  },
  {
    id: "txn-06",
    description: "Booktopia",
    date: "2024-07-20",
    account_name: "Westpac Debit",
    amount: "-38.70",
    currency: "AUD",
    direction: "debit",
    category_name: "Personal Spending"
  },
  {
    id: "txn-07",
    description: "Cafe Del Mar",
    date: "2024-07-18",
    account_name: "Westpac Debit",
    amount: "-68.50",
    currency: "AUD",
    direction: "debit",
    category_name: "Recreation & Entertainment"
  },
  {
    id: "txn-08",
    description: "Local Pharmacy",
    date: "2024-07-17",
    account_name: "Westpac Debit",
    amount: "-21.90",
    currency: "AUD",
    direction: "debit",
    category_name: "Uncategorised"
  }
];

