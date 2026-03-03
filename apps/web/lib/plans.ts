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

  // Start with plan features
  let features = [...planFeatures];

  // Process overrides
  for (const override of overrides) {
    if (override.startsWith('!')) {
      // Negated feature - remove it
      const feature = override.substring(1);
      features = features.filter(f => f !== feature);
    } else {
      // Added feature - add it if not already present
      if (!features.includes(override)) {
        features.push(override);
      }
    }
  }

  return features;
}

export function hasFeature(planId: string, featureOverrides: string, featureKey: string): boolean {
  return getWorkspaceFeatures(planId, featureOverrides).includes(featureKey);
}

export function calculateOverrides(planId: string, activeFeatures: string[]): string[] {
  const planFeatures = getPlanConfig(planId).features;
  const overrides: string[] = [];

  // Add features that are active but not in the base plan
  for (const feature of activeFeatures) {
    if (!planFeatures.includes(feature)) {
      overrides.push(feature);
    }
  }

  // Add negated features that are in the base plan but not active
  for (const feature of planFeatures) {
    if (!activeFeatures.includes(feature)) {
      overrides.push(`!${feature}`);
    }
  }

  return overrides;
}
