import { describe, it, expect } from "vitest";
import { isSuperadmin } from "../admin-guard";

describe("isSuperadmin", () => {
  it("returns true when user has superadmin label", () => {
    expect(isSuperadmin(["superadmin"])).toBe(true);
  });

  it("returns true when superadmin is among multiple labels", () => {
    expect(isSuperadmin(["beta", "superadmin", "vip"])).toBe(true);
  });

  it("returns false when user has no labels", () => {
    expect(isSuperadmin([])).toBe(false);
  });

  it("returns false when user has other labels but not superadmin", () => {
    expect(isSuperadmin(["beta", "vip"])).toBe(false);
  });

  it("returns false for undefined/null labels", () => {
    expect(isSuperadmin(undefined as any)).toBe(false);
    expect(isSuperadmin(null as any)).toBe(false);
  });
});
