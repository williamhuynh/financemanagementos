export type NavItem = {
  id: string;
  label: string;
  href: string;
};

export const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "ledger", label: "Ledger", href: "/ledger" },
  { id: "review", label: "Review Queue", href: "/review" },
  { id: "assets", label: "Assets", href: "/assets" },
  { id: "import", label: "Import Hub", href: "/import-hub" },
  { id: "reports", label: "Reports", href: "/reports" },
  { id: "ui-showcase", label: "UI Showcase", href: "/ui-showcase" },
  { id: "health", label: "Health", href: "/health" },
  { id: "settings", label: "Settings", href: "/settings" }
];

export const statCards = [
  { title: "Cash", value: "$72,279", sub: "+1.1% MoM", tone: "glow" },
  { title: "Investments", value: "$548,194", sub: "+3.4% MoM", tone: "glow" },
  { title: "Property", value: "$2,053,240", sub: "Stable", tone: "glow" },
  { title: "Liabilities", value: "$1,786,974", sub: "Mortgage + credit", tone: "negative" }
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
    title: "OSKO Payment Pui Kwan Peggy",
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
  { title: "Property", value: "$2,053,240", sub: "Last update: Mar 2025" },
  { title: "Stocks", value: "$277,247", sub: "CMC Markets" },
  { title: "Managed Funds", value: "$42,360", sub: "Vanguard" },
  { title: "Superannuation", value: "$226,926", sub: "AustralianSuper" }
];

export const reportStats = [
  { title: "Income", value: "$19,398", sub: "Primary + secondary" },
  { title: "Expenses", value: "$8,580", sub: "All categories" },
  { title: "Transfers Excluded", value: "$3,559", sub: "Matched pairs" }
];

