import { Client, Databases, ID, Query } from "node-appwrite";

const endpoint = process.env.APPWRITE_ENDPOINT || process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const projectId =
  process.env.APPWRITE_PROJECT_ID || process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const databaseId =
  process.env.APPWRITE_DATABASE_ID || process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID;
const apiKey = process.env.APPWRITE_API_KEY;

if (!endpoint || !projectId || !databaseId || !apiKey) {
  console.error("Missing Appwrite env vars.");
  console.error(
    "Set APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_DATABASE_ID, APPWRITE_API_KEY."
  );
  process.exit(1);
}

const client = new Client();
client.setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const databases = new Databases(client);

const seed = {
  dashboard_cards: [
    { title: "Cash", value: "$72,279", sub: "+1.1% MoM", tone: "glow" },
    { title: "Investments", value: "$548,194", sub: "+3.4% MoM", tone: "glow" },
    { title: "Property", value: "$2,053,240", sub: "Stable", tone: "glow" },
    { title: "Liabilities", value: "$1,786,974", sub: "Mortgage + credit", tone: "negative" }
  ],
  ledger_rows: [
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
    }
  ],
  review_items: [
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
    }
  ],
  asset_cards: [
    { title: "Property", value: "$2,053,240", sub: "Last update: Mar 2025" },
    { title: "Stocks", value: "$277,247", sub: "CMC Markets" },
    { title: "Managed Funds", value: "$42,360", sub: "Vanguard" },
    { title: "Superannuation", value: "$226,926", sub: "AustralianSuper" }
  ],
  report_stats: [
    { title: "Income", value: "$19,398", sub: "Primary + secondary" },
    { title: "Expenses", value: "$8,580", sub: "All categories" },
    { title: "Transfers Excluded", value: "$3,559", sub: "Matched pairs" }
  ]
};

function getUniqueQueries(collectionId, item) {
  if (collectionId === "ledger_rows" || collectionId === "review_items") {
    return [Query.equal("title", item.title), Query.equal("sub", item.sub)];
  }

  return [Query.equal("title", item.title)];
}

async function createIfMissing(collectionId, item) {
  const existing = await databases.listDocuments(
    databaseId,
    collectionId,
    getUniqueQueries(collectionId, item)
  );

  if (existing.total > 0) {
    console.log(`Exists: ${collectionId} -> ${item.title}`);
    return;
  }

  await databases.createDocument(databaseId, collectionId, ID.unique(), item);
  console.log(`Inserted: ${collectionId} -> ${item.title}`);
}

async function run() {
  for (const [collectionId, items] of Object.entries(seed)) {
    for (const item of items) {
      await createIfMissing(collectionId, item);
    }
  }
}

run().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
