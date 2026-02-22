export const PLAN_IDS = {
  FREE: "free",
  PRO: "pro",
} as const;

export type PlanId = (typeof PLAN_IDS)[keyof typeof PLAN_IDS];

export type LimitKey = "maxAccounts" | "maxAssets" | "maxMembers";

interface PlanLimits {
  maxAccounts: number;
  maxAssets: number;
  maxMembers: number;
}

interface PlanConfig {
  label: string;
  limits: PlanLimits;
  features: string[];
}

export const ALL_FEATURES = [
  "csv_import",
  "pdf_import",
  "manual_assets",
  "ai_categorization",
  "voice_logs",
  "bank_feeds",
] as const;

export type FeatureKey = (typeof ALL_FEATURES)[number];

const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    label: "Free",
    limits: {
      maxAccounts: 5,
      maxAssets: 8,
      maxMembers: 2,
    },
    features: [
      "csv_import",
      "pdf_import",
      "manual_assets",
      "ai_categorization",
      "voice_logs",
      "bank_feeds",
    ],
  },
  pro: {
    label: "Pro",
    limits: {
      maxAccounts: Infinity,
      maxAssets: Infinity,
      maxMembers: 5,
    },
    features: [
      "csv_import",
      "pdf_import",
      "manual_assets",
      "ai_categorization",
      "voice_logs",
      "bank_feeds",
    ],
  },
};

export function getPlanConfig(planId: string): PlanConfig {
  return PLANS[planId as PlanId] ?? PLANS.free;
}

export function getLimit(planId: string, limitKey: LimitKey): number {
  return getPlanConfig(planId).limits[limitKey];
}

export function isAtLimit(planId: string, currentCount: number, limitKey: LimitKey): boolean {
  const limit = getLimit(planId, limitKey);
  if (limit === Infinity) return false;
  return currentCount >= limit;
}

function parseOverrides(featureOverrides: string): string[] {
  try {
    const parsed = JSON.parse(featureOverrides);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getWorkspaceFeatures(planId: string, featureOverrides: string): string[] {
  const planFeatures = getPlanConfig(planId).features;
  const overrides = parseOverrides(featureOverrides);
  return [...new Set([...planFeatures, ...overrides])];
}

export function hasFeature(planId: string, featureOverrides: string, featureKey: string): boolean {
  return getWorkspaceFeatures(planId, featureOverrides).includes(featureKey);
}
