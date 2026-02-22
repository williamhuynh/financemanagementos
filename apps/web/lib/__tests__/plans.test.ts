import { describe, it, expect } from "vitest";
import {
  PLAN_IDS,
  getPlanConfig,
  getLimit,
  isAtLimit,
  hasFeature,
  getWorkspaceFeatures,
} from "../plans";

describe("PLAN_IDS", () => {
  it("exports free and pro constants", () => {
    expect(PLAN_IDS.FREE).toBe("free");
    expect(PLAN_IDS.PRO).toBe("pro");
  });
});

describe("getPlanConfig", () => {
  it("returns free plan config", () => {
    const config = getPlanConfig("free");
    expect(config.label).toBe("Free");
    expect(config.limits.maxAccounts).toBe(5);
    expect(config.limits.maxAssets).toBe(8);
    expect(config.limits.maxMembers).toBe(2);
  });

  it("returns pro plan config", () => {
    const config = getPlanConfig("pro");
    expect(config.label).toBe("Pro");
    expect(config.limits.maxAccounts).toBe(Infinity);
    expect(config.limits.maxAssets).toBe(Infinity);
    expect(config.limits.maxMembers).toBe(5);
  });

  it("falls back to free for unknown plan id", () => {
    const config = getPlanConfig("enterprise");
    expect(config.label).toBe("Free");
    expect(config.limits.maxAccounts).toBe(5);
  });

  it("falls back to free for empty string", () => {
    const config = getPlanConfig("");
    expect(config.label).toBe("Free");
  });
});

describe("getLimit", () => {
  it("returns numeric limits for free plan", () => {
    expect(getLimit("free", "maxAccounts")).toBe(5);
    expect(getLimit("free", "maxAssets")).toBe(8);
    expect(getLimit("free", "maxMembers")).toBe(2);
  });

  it("returns Infinity for pro unlimited limits", () => {
    expect(getLimit("pro", "maxAccounts")).toBe(Infinity);
    expect(getLimit("pro", "maxAssets")).toBe(Infinity);
  });

  it("returns numeric limit for pro members", () => {
    expect(getLimit("pro", "maxMembers")).toBe(5);
  });
});

describe("isAtLimit", () => {
  it("returns true when count equals limit", () => {
    expect(isAtLimit("free", 5, "maxAccounts")).toBe(true);
  });

  it("returns true when count exceeds limit", () => {
    expect(isAtLimit("free", 10, "maxAccounts")).toBe(true);
  });

  it("returns false when count is under limit", () => {
    expect(isAtLimit("free", 3, "maxAccounts")).toBe(false);
  });

  it("returns false for Infinity limits regardless of count", () => {
    expect(isAtLimit("pro", 9999, "maxAccounts")).toBe(false);
    expect(isAtLimit("pro", 0, "maxAssets")).toBe(false);
  });
});

describe("hasFeature", () => {
  it("returns true for features included in the plan", () => {
    expect(hasFeature("free", "[]", "csv_import")).toBe(true);
    expect(hasFeature("free", "[]", "ai_categorization")).toBe(true);
  });

  it("returns true for features added via overrides", () => {
    expect(hasFeature("free", '["custom_feature"]', "custom_feature")).toBe(true);
  });

  it("returns false for features not in plan or overrides", () => {
    expect(hasFeature("free", "[]", "nonexistent_feature")).toBe(false);
  });

  it("handles malformed JSON in overrides gracefully", () => {
    expect(hasFeature("free", "not valid json", "csv_import")).toBe(true);
    expect(hasFeature("free", "not valid json", "nonexistent")).toBe(false);
  });

  it("handles empty string overrides", () => {
    expect(hasFeature("free", "", "csv_import")).toBe(true);
    expect(hasFeature("free", "", "nonexistent")).toBe(false);
  });

  it("handles non-array JSON overrides", () => {
    expect(hasFeature("free", '{"key": "value"}', "csv_import")).toBe(true);
    expect(hasFeature("free", '{"key": "value"}', "nonexistent")).toBe(false);
  });
});

describe("getWorkspaceFeatures", () => {
  it("returns plan features when no overrides", () => {
    const features = getWorkspaceFeatures("free", "[]");
    expect(features).toContain("csv_import");
    expect(features).toContain("pdf_import");
    expect(features).toContain("manual_assets");
    expect(features).toContain("ai_categorization");
    expect(features).toContain("voice_logs");
    expect(features).toContain("bank_feeds");
  });

  it("merges plan features with overrides", () => {
    const features = getWorkspaceFeatures("free", '["custom_feature"]');
    expect(features).toContain("csv_import");
    expect(features).toContain("custom_feature");
  });

  it("deduplicates features present in both plan and overrides", () => {
    const features = getWorkspaceFeatures("free", '["csv_import", "extra"]');
    const csvCount = features.filter((f) => f === "csv_import").length;
    expect(csvCount).toBe(1);
    expect(features).toContain("extra");
  });

  it("handles malformed override JSON by returning only plan features", () => {
    const features = getWorkspaceFeatures("free", "broken json");
    expect(features).toContain("csv_import");
    expect(features.length).toBe(6);
  });
});
