import { describe, it, expect } from "vitest";
import { isAllowedEmail } from "../auth";

describe("isAllowedEmail", () => {
  it("returns true for a valid email", () => {
    expect(isAllowedEmail("user@example.com")).toBe(true);
  });

  it("returns true for any string containing @", () => {
    expect(isAllowedEmail("a@b")).toBe(true);
  });

  it("returns false for a string without @", () => {
    expect(isAllowedEmail("notanemail")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isAllowedEmail("")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isAllowedEmail(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isAllowedEmail(undefined)).toBe(false);
  });
});
