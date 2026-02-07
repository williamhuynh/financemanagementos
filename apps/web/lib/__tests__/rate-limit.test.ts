import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, AUTH_RATE_LIMITS } from "../rate-limit";

function makeRequest(path: string, ip = "127.0.0.1"): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

// The rate limiter uses a module-level Map. We need to avoid
// cross-test pollution by using distinct IPs per test.

describe("rateLimit", () => {
  it("allows requests under the limit", () => {
    const config = { limit: 3, windowMs: 60_000 };
    const ip = "10.0.0.1";

    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
  });

  it("blocks requests that exceed the limit", () => {
    const config = { limit: 2, windowMs: 60_000 };
    const ip = "10.0.0.2";

    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();

    const blocked = rateLimit(makeRequest("/api/auth/login", ip), config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("tracks different paths independently", () => {
    const config = { limit: 1, windowMs: 60_000 };
    const ip = "10.0.0.3";

    expect(rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(rateLimit(makeRequest("/api/auth/signup", ip), config)).toBeNull();

    // Second hit on /login should be blocked
    const blocked = rateLimit(makeRequest("/api/auth/login", ip), config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("tracks different IPs independently", () => {
    const config = { limit: 1, windowMs: 60_000 };

    expect(rateLimit(makeRequest("/api/auth/login", "10.0.0.4"), config)).toBeNull();
    expect(rateLimit(makeRequest("/api/auth/login", "10.0.0.5"), config)).toBeNull();
  });

  it("returns 429 with Retry-After header", async () => {
    const config = { limit: 1, windowMs: 60_000 };
    const ip = "10.0.0.6";

    rateLimit(makeRequest("/api/auth/login", ip), config);
    const blocked = rateLimit(makeRequest("/api/auth/login", ip), config);

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeDefined();

    const body = await blocked!.json();
    expect(body.error).toContain("Too many requests");
  });
});

describe("AUTH_RATE_LIMITS presets", () => {
  it("has sensible defaults for login", () => {
    expect(AUTH_RATE_LIMITS.login.limit).toBeGreaterThanOrEqual(3);
    expect(AUTH_RATE_LIMITS.login.windowMs).toBeGreaterThanOrEqual(60_000);
  });

  it("has stricter limits for signup than invitations", () => {
    expect(AUTH_RATE_LIMITS.signup.limit).toBeLessThanOrEqual(
      AUTH_RATE_LIMITS.invitation.limit
    );
  });

  it("has all required auth endpoints defined", () => {
    expect(AUTH_RATE_LIMITS).toHaveProperty("login");
    expect(AUTH_RATE_LIMITS).toHaveProperty("signup");
    expect(AUTH_RATE_LIMITS).toHaveProperty("forgotPassword");
    expect(AUTH_RATE_LIMITS).toHaveProperty("resetPassword");
    expect(AUTH_RATE_LIMITS).toHaveProperty("invitation");
  });
});
