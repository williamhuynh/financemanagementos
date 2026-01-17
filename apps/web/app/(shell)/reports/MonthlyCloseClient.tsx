"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, DonutChart, ListRow } from "@financelab/ui";
import ExpenseCategoryList from "./expenses/ExpenseCategoryList";
import type { ExpenseBreakdown, MonthlyCloseSummary } from "../../../lib/data";
import { useNumberVisibility } from "../../../lib/number-visibility-context";
import { maskCurrencyValue } from "../../../lib/data";

type MonthlyCloseClientProps = {
  summary: MonthlyCloseSummary;
  expenseBreakdown: ExpenseBreakdown;
};

type ActionState = "idle" | "saving" | "error";

function formatTimestamp(value?: string) {
  if (!value) {
    return "";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.valueOf())) {
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

export default function MonthlyCloseClient({
  summary,
  expenseBreakdown
}: MonthlyCloseClientProps) {
  const { isVisible } = useNumberVisibility();
  const router = useRouter();
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [error, setError] = useState<string>("");
  const spendByCategory = expenseBreakdown.categories;
  const totalSpend = spendByCategory.reduce((sum, item) => sum + item.amount, 0);
  const totalFormatted = expenseBreakdown.totalFormatted;
  const topCategory = spendByCategory[0];
  const categoryCount = spendByCategory.length;
  const topCategories = spendByCategory.slice(0, 3);
  const otherTotal = spendByCategory
    .slice(3)
    .reduce((sum, item) => sum + Math.abs(item.amount), 0);
  const segmentClasses = ["seg-a", "seg-b", "seg-c"];
  const dotClasses = ["a", "b", "c"];
  const spendSegments = topCategories.map((item, index) => ({
    className: segmentClasses[index],
    value: item.amount
  }));
  const spendLegend = topCategories.map((item, index) => ({
    label: `${item.name} ${item.percent}%`,
    dot: dotClasses[index]
  }));

  const monthLabel = useMemo(() => {
    const match = summary.monthOptions.find(
      (option) => option.value === summary.selectedMonth
    );
    return match?.label ?? summary.selectedMonth;
  }, [summary.monthOptions, summary.selectedMonth]);

  const statusLabel = summary.status === "closed" ? "Closed" : "Open";
  const statusTone = summary.status === "closed" ? "confirmed" : "";
  const statusDetail =
    summary.status === "closed"
      ? summary.closedAt
        ? `Closed ${formatTimestamp(summary.closedAt)}`
        : "Closed"
      : summary.reopenedAt
        ? `Reopened ${formatTimestamp(summary.reopenedAt)}`
        : "Month is open";

  if (otherTotal > 0 && totalSpend > 0) {
    const otherPercent = Math.round((otherTotal / totalSpend) * 100);
    spendSegments.push({ className: "seg-d", value: otherTotal });
    spendLegend.push({ label: `Other ${otherPercent}%`, dot: "d" });
  }

  const handleAction = async (action: "close" | "reopen") => {
    setActionState("saving");
    setError("");
    try {
      const response = await fetch("/api/monthly-close", {
        method: action === "close" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: summary.selectedMonth })
      });
      if (!response.ok) {
        const data = (await response.json()) as { detail?: string };
        throw new Error(data.detail || "Unable to update month status.");
      }
      router.refresh();
      setActionState("idle");
    } catch (err) {
      setActionState("error");
      setError(err instanceof Error ? err.message : "Unable to update month.");
    }
  };

  return (
    <section className="monthly-close">
      <div className="monthly-close-head">
        <div>
          <div className="eyebrow">Month</div>
          <div className="month-title">{monthLabel}</div>
          <div className="month-sub">{statusDetail}</div>
        </div>
        <div className="monthly-close-actions">
          <span className={`status-pill ${statusTone}`}>{statusLabel}</span>
          {summary.status === "closed" ? (
            <button
              className="pill"
              type="button"
              onClick={() => handleAction("reopen")}
              disabled={actionState === "saving"}
            >
              {actionState === "saving" ? "Reopening..." : "Reopen month"}
            </button>
          ) : (
            <button
              className="pill active"
              type="button"
              onClick={() => handleAction("close")}
              disabled={actionState === "saving"}
            >
              {actionState === "saving" ? "Closing..." : "Close month"}
            </button>
          )}
        </div>
      </div>

      <div className="grid cards">
        <Card title="Income" value={maskCurrencyValue(summary.formattedIncomeTotal, isVisible)} sub="Month total" />
        <Card title="Expenses" value={maskCurrencyValue(summary.formattedExpenseTotal, isVisible)} sub="Month total" />
        <Card
          title="Transfers Excluded"
          value={maskCurrencyValue(summary.formattedTransferOutflowTotal, isVisible)}
          sub="Outflows only"
        />
        <Card title="Net Worth" value={maskCurrencyValue(summary.formattedNetWorthTotal, isVisible)} sub="Month-end" />
      </div>

      <div className="monthly-close-meta">
        <div className="meta-pill">Assets {maskCurrencyValue(summary.formattedAssetsTotal, isVisible)}</div>
        <div className="meta-pill">Liabilities {maskCurrencyValue(summary.formattedLiabilitiesTotal, isVisible)}</div>
        <div className="meta-pill">Assets use latest recorded values</div>
      </div>

      <div className="monthly-close-checklist">
        <div className="card-title">Close checklist</div>
        <div className="checklist">
          {summary.checklist.map((item) => (
            <div key={item.id} className={`checklist-item ${item.status}`}>
              <span className="checklist-label">{item.label}</span>
              <span className="checklist-detail">{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <details className="report-accordion">
        <summary className="report-accordion-summary">
          <span>Expense detail</span>
          <span className="report-accordion-meta">{maskCurrencyValue(totalFormatted, isVisible)} total</span>
        </summary>
        <div className="report-accordion-body">
          {spendByCategory.length > 0 ? (
            <>
              <div className="grid cards">
                <Card
                  title="Total expenses"
                  value={maskCurrencyValue(totalFormatted, isVisible)}
                  sub="Recent activity"
                />
                <Card
                  title="Top category"
                  value={topCategory?.name ?? "No data"}
                  sub={
                    topCategory
                      ? `${topCategory.percent}% of spend`
                      : "No category totals yet"
                  }
                />
                <Card
                  title="Categories"
                  value={`${categoryCount}`}
                  sub="Active buckets"
                />
              </div>
              <div className="grid charts">
                <DonutChart
                  title="Spend mix"
                  segments={spendSegments}
                  legend={spendLegend}
                />
                <article className="card">
                  <div className="card-title">Category detail</div>
                  <div className="list">
                    {spendByCategory.map((item) => (
                      <ListRow
                        key={item.name}
                        title={item.name}
                        sub={`${item.count} transactions - ${item.percent}% of spend`}
                        category={`${item.percent}% share`}
                        amount={maskCurrencyValue(item.formattedAmount, isVisible)}
                        tone={item.amount >= 0 ? "positive" : "negative"}
                      />
                    ))}
                  </div>
                </article>
              </div>
              <div className="section-head">
                <div>
                  <div className="eyebrow">Expense Detail</div>
                  <h2>Recent transactions by category</h2>
                </div>
              </div>
              <ExpenseCategoryList
                categories={spendByCategory}
                selectedMonth={expenseBreakdown.selectedMonth}
              />
            </>
          ) : (
            <div className="empty-state">No spend data yet.</div>
          )}
        </div>
      </details>

      {error ? <div className="form-error">{error}</div> : null}
    </section>
  );
}
