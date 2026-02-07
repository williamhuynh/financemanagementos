import { redirect } from "next/navigation";
import { SectionHead } from "@financelab/ui";
import CashLogClient from "./CashLogClient";
import { fetchCashLogs, fetchCategories } from "../../../lib/cash-logs-service";
import { getApiContext } from "../../../lib/api-auth";


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
  // Authenticate and get workspace context
  const context = await getApiContext();
  if (!context) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const selectedMonth = resolvedSearchParams?.month || getCurrentMonth();

  // Fetch logs and categories in parallel
  const [logs, categories] = await Promise.all([
    fetchCashLogs(context.workspaceId, selectedMonth),
    fetchCategories(context.workspaceId),
  ]);
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
