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

  const url = `${baseUrl}/api/cash-logs?${params}`;
  console.log("[CASH-PAGE] Fetching logs from:", url);

  try {
    const response = await fetch(url, {
      cache: "no-store"
    });
    console.log("[CASH-PAGE] Response status:", response.status);
    if (!response.ok) {
      console.error("[CASH-PAGE] Response not OK:", response.status, response.statusText);
      return [];
    }
    const data = await response.json();
    console.log("[CASH-PAGE] Received data:", data);
    console.log("[CASH-PAGE] Logs count:", data.logs?.length ?? 0);
    return data.logs ?? [];
  } catch (error) {
    console.error("[CASH-PAGE] Fetch error:", error);
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
  // Use ISO date string to avoid timezone issues
  const isoDate = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"
  return isoDate.substring(0, 7); // "YYYY-MM"
}

function buildMonthOptions(count = 6) {
  const options: { value: string; label: string }[] = [];
  // Get current month in YYYY-MM format
  const currentMonth = getCurrentMonth();
  const [year, month] = currentMonth.split("-").map(Number);

  for (let i = 0; i < count; i++) {
    // Calculate year and month offset
    let targetYear = year;
    let targetMonth = month - i;

    // Handle year rollover
    while (targetMonth < 1) {
      targetMonth += 12;
      targetYear -= 1;
    }

    const monthStr = String(targetMonth).padStart(2, "0");
    const value = `${targetYear}-${monthStr}`;

    // Create date for formatting label (using UTC to avoid timezone issues)
    const date = new Date(Date.UTC(targetYear, targetMonth - 1, 1));
    const label = date.toLocaleDateString("en-AU", {
      month: "short",
      year: "numeric",
      timeZone: "UTC"
    });

    options.push({ value, label });
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
  console.log("[CASH-PAGE] Selected month:", selectedMonth);
  const logs = await getCashLogs(selectedMonth);
  console.log("[CASH-PAGE] Received", logs.length, "logs from getCashLogs");
  const categories = await getCategories();
  const monthOptions = buildMonthOptions(6);
  console.log("[CASH-PAGE] Month options:", monthOptions.map(o => o.value).join(", "));

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
