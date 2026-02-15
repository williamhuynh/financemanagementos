import { describe, it, expect } from "vitest";
import {
  generateCsrfToken,
  validateCsrfToken,
  isCsrfExempt,
  CSRF_EXEMPT_ROUTES,
  CSRF_PROTECTED_METHODS,
} from "../csrf";

describe("generateCsrfToken", () => {
  it("returns a 64-character hex string (32 bytes)", () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("generates unique tokens on each call", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateCsrfToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("validateCsrfToken", () => {
  it("returns true when header and session match", () => {
    const token = generateCsrfToken();
    expect(validateCsrfToken(token, token)).toBe(true);
  });

  it("returns false when tokens differ", () => {
    const a = generateCsrfToken();
    const b = generateCsrfToken();
    expect(validateCsrfToken(a, b)).toBe(false);
  });

  it("returns false when header is null", () => {
    expect(validateCsrfToken(null, generateCsrfToken())).toBe(false);
  });

  it("returns false when session value is undefined", () => {
    expect(validateCsrfToken(generateCsrfToken(), undefined)).toBe(false);
  });

  it("returns false when both are empty", () => {
    expect(validateCsrfToken("", "")).toBe(false);
  });

  it("returns false for different-length strings", () => {
    expect(validateCsrfToken("short", "muchlongerstring")).toBe(false);
  });

  it("is timing-safe (does not short-circuit on first mismatch)", () => {
    // We can't directly test timing, but we verify the logic path
    // handles same-length different strings correctly
    const base = generateCsrfToken();
    const modified = "0" + base.slice(1);
    expect(validateCsrfToken(base, modified)).toBe(false);
  });
});

describe("isCsrfExempt", () => {
  it("exempts login route", () => {
    expect(isCsrfExempt("/api/auth/login")).toBe(true);
  });

  it("exempts signup route", () => {
    expect(isCsrfExempt("/api/auth/signup")).toBe(true);
  });

  it("exempts health check", () => {
    expect(isCsrfExempt("/api/health")).toBe(true);
    expect(isCsrfExempt("/api/health/appwrite")).toBe(true);
  });

  it("does NOT exempt data routes", () => {
    expect(isCsrfExempt("/api/categories")).toBe(false);
    expect(isCsrfExempt("/api/assets")).toBe(false);
    expect(isCsrfExempt("/api/ledger")).toBe(false);
  });

  it("does NOT exempt invitation accept route", () => {
    expect(isCsrfExempt("/api/invitations/accept")).toBe(false);
  });

  it("does exempt invitation verify route", () => {
    expect(isCsrfExempt("/api/invitations/verify")).toBe(true);
  });
});

describe("CSRF constants", () => {
  it("CSRF_EXEMPT_ROUTES includes all expected auth routes", () => {
    expect(CSRF_EXEMPT_ROUTES).toContain("/api/auth/login");
    expect(CSRF_EXEMPT_ROUTES).toContain("/api/auth/signup");
    expect(CSRF_EXEMPT_ROUTES).toContain("/api/auth/forgot-password");
    expect(CSRF_EXEMPT_ROUTES).toContain("/api/auth/reset-password");
  });

  it("CSRF_PROTECTED_METHODS covers state-mutating verbs", () => {
    expect(CSRF_PROTECTED_METHODS).toContain("POST");
    expect(CSRF_PROTECTED_METHODS).toContain("PATCH");
    expect(CSRF_PROTECTED_METHODS).toContain("DELETE");
  });

  it("CSRF_PROTECTED_METHODS does not include GET", () => {
    expect(CSRF_PROTECTED_METHODS).not.toContain("GET");
  });
});
