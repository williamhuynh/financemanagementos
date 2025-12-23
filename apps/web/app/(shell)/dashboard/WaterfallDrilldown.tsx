"use client";

import { useMemo, useState } from "react";
import { WaterfallChart, type WaterfallStep } from "@financelab/ui";
import type { CashFlowWaterfall, CashFlowTransaction } from "../../../lib/data";

type WaterfallDrilldownProps = {
  cashFlow: CashFlowWaterfall;
};

export default function WaterfallDrilldown({ cashFlow }: WaterfallDrilldownProps) {
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  const activeStep = useMemo(
    () => cashFlow.steps.find((step) => step.label === activeLabel) ?? null,
    [cashFlow.steps, activeLabel]
  );

  const sortedTransactions = useMemo(() => {
    const items = activeStep?.transactions ?? [];
    if (items.length === 0) {
      return [] as CashFlowTransaction[];
    }
    return [...items].sort((a, b) => b.dateValue - a.dateValue);
  }, [activeStep]);

  const handleStepClick = (step: WaterfallStep) => {
    setActiveLabel((prev) => (prev === step.label ? null : step.label));
  };

  if (cashFlow.steps.length === 0) {
    return (
      <article className="card chart wide">
        <div className="card-title">Cash Flow Waterfall</div>
        <div className="empty-state">No cash flow data yet.</div>
      </article>
    );
  }

  return (
    <>
      <WaterfallChart
        steps={cashFlow.steps}
        height={300}
        activeStepLabel={activeLabel}
        onStepClick={handleStepClick}
      />
      {activeStep ? (
        <article className="card chart wide">
          <div className="chart-head">
            <div>
              <div className="card-title">{activeStep.label} transactions</div>
              <div className="card-sub">{sortedTransactions.length} items</div>
            </div>
          </div>
          {sortedTransactions.length > 0 ? (
            <div className="list">
              {sortedTransactions.map((txn) => (
                <div key={txn.id} className="list-row">
                  <div>
                    <div className="row-title">{txn.title}</div>
                    <div className="row-sub">{txn.sub}</div>
                  </div>
                  <div className="row-meta">
                    <span className={`amount ${txn.tone}`}>{txn.amount}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No transactions for this step.</div>
          )}
        </article>
      ) : null}
    </>
  );
}
