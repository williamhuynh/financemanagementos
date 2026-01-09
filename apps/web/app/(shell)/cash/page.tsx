import { SectionHead } from "@financelab/ui";
import CashLogClient from "./CashLogClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCashLogs(month?: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const params = new URLSearchParams();
  if (month) {
    params.set("month", month);
  }

  try {
    const response = await fetch(`${baseUrl}/api/cash-logs?${params}`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.logs ?? [];
  } catch {
    return [];
  }
}

async function getCategories() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/categories`, {
      cache: "no-store"
    });
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data.categories ?? [];
  } catch {
    return [];
  }
}

function getCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function buildMonthOptions(count = 6) {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const label = date.toLocaleDateString("en-AU", {
      month: "short",
      year: "numeric"
    });
    options.push({ value: `${year}-${month}`, label });
  }
  return options;
}

type CashSearchParams = {
  month?: string;
};

type CashPageProps = {
  searchParams?: Promise<CashSearchParams>;
};

export default async function CashPage({ searchParams }: CashPageProps) {
  const resolvedSearchParams = await searchParams;
  const selectedMonth = resolvedSearchParams?.month || getCurrentMonth();
  const logs = await getCashLogs(selectedMonth);
  const categories = await getCategories();
  const monthOptions = buildMonthOptions(6);

  return (
    <>
      <SectionHead
        eyebrow="Cash Log"
        title="Quick Entry"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "Cash Log" }
        ]}
      />
      <CashLogClient
        initialLogs={logs}
        categories={categories}
        monthOptions={monthOptions}
        selectedMonth={selectedMonth}
      />
    </>
  );
}
