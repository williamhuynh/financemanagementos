"use client";

import { useEffect, useState } from "react";
import { Card } from "@tandemly/ui";

interface BillingData {
  plan: string;
  planLabel: string;
  limits: { maxAccounts: number; maxAssets: number; maxMembers: number };
  usage: { accounts: number; assets: number; members: number };
}

function UsageRow({
  label,
  current,
  max,
}: {
  label: string;
  current: number;
  max: number;
}) {
  const isUnlimited = max === null || !isFinite(max);
  const pct = isUnlimited ? 0 : Math.min((current / max) * 100, 100);
  const atLimit = !isUnlimited && current >= max;

  return (
    <div className="billing-usage-row">
      <div className="billing-usage-label">
        <span>{label}</span>
        <span className={atLimit ? "billing-at-limit" : ""}>
          {current}
          {isUnlimited ? "" : ` / ${max}`}
        </span>
      </div>
      {!isUnlimited && (
        <div className="billing-usage-bar">
          <div
            className={`billing-usage-bar-fill${atLimit ? " billing-usage-bar-full" : ""}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function BillingClient({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/billing", { credentials: "include" })
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [workspaceId]);

  if (loading) return <Card title="Plan"><p style={{ padding: 20 }}>Loading...</p></Card>;
  if (!data) return <Card title="Plan"><p style={{ padding: 20 }}>Failed to load billing data.</p></Card>;

  return (
    <>
      <Card title="Current Plan">
        <div className="billing-plan-badge">
          <span className="billing-plan-name">{data.planLabel}</span>
          {data.plan === "free" && (
            <span className="billing-upgrade-hint">
              Upgrade to Pro for unlimited accounts, assets, and more members.
            </span>
          )}
        </div>
      </Card>

      <Card title="Usage">
        <div className="billing-usage">
          <UsageRow label="Accounts" current={data.usage.accounts} max={data.limits.maxAccounts} />
          <UsageRow label="Assets" current={data.usage.assets} max={data.limits.maxAssets} />
          <UsageRow label="Members" current={data.usage.members} max={data.limits.maxMembers} />
        </div>
      </Card>
    </>
  );
}
