import { describe, it, expect } from "vitest";
import { rateLimit, AUTH_RATE_LIMITS, DATA_RATE_LIMITS } from "../rate-limit";

function makeRequest(path: string, ip = "127.0.0.1"): Request {
  return new Request(`http://localhost:3000${path}`, {
    headers: { "x-forwarded-for": ip },
  });
}

// The rate limiter uses a module-level Map. We need to avoid
// cross-test pollution by using distinct IPs per test.

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    const config = { limit: 3, windowMs: 60_000 };
    const ip = "10.0.0.1";

    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
  });

  it("blocks requests that exceed the limit", async () => {
    const config = { limit: 2, windowMs: 60_000 };
    const ip = "10.0.0.2";

    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();

    const blocked = await rateLimit(makeRequest("/api/auth/login", ip), config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("tracks different paths independently", async () => {
    const config = { limit: 1, windowMs: 60_000 };
    const ip = "10.0.0.3";

    expect(await rateLimit(makeRequest("/api/auth/login", ip), config)).toBeNull();
    expect(await rateLimit(makeRequest("/api/auth/signup", ip), config)).toBeNull();

    // Second hit on /login should be blocked
    const blocked = await rateLimit(makeRequest("/api/auth/login", ip), config);
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
  });

  it("tracks different IPs independently", async () => {
    const config = { limit: 1, windowMs: 60_000 };

    expect(await rateLimit(makeRequest("/api/auth/login", "10.0.0.4"), config)).toBeNull();
    expect(await rateLimit(makeRequest("/api/auth/login", "10.0.0.5"), config)).toBeNull();
  });

  it("returns 429 with Retry-After header", async () => {
    const config = { limit: 1, windowMs: 60_000 };
    const ip = "10.0.0.6";

    await rateLimit(makeRequest("/api/auth/login", ip), config);
    const blocked = await rateLimit(makeRequest("/api/auth/login", ip), config);

    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeDefined();

    const body = await blocked!.json();
    expect(body.error).toContain("Too many requests");
  });

  it("Retry-After header is always >= 1", async () => {
    const config = { limit: 1, windowMs: 1 }; // tiny window
    const ip = "10.0.0.7";

    await rateLimit(makeRequest("/api/test", ip), config);
    const blocked = await rateLimit(makeRequest("/api/test", ip), config);

    if (blocked) {
      const retryAfter = Number(blocked.headers.get("Retry-After"));
      expect(retryAfter).toBeGreaterThanOrEqual(1);
    }
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

describe("DATA_RATE_LIMITS presets", () => {
  it("has all required data endpoint categories", () => {
    expect(DATA_RATE_LIMITS).toHaveProperty("read");
    expect(DATA_RATE_LIMITS).toHaveProperty("write");
    expect(DATA_RATE_LIMITS).toHaveProperty("delete");
    expect(DATA_RATE_LIMITS).toHaveProperty("bulk");
    expect(DATA_RATE_LIMITS).toHaveProperty("ai");
    expect(DATA_RATE_LIMITS).toHaveProperty("export");
    expect(DATA_RATE_LIMITS).toHaveProperty("accountDelete");
  });

  it("write limits are stricter than read limits", () => {
    expect(DATA_RATE_LIMITS.write.limit).toBeLessThan(DATA_RATE_LIMITS.read.limit);
  });

  it("bulk limits are stricter than write limits", () => {
    expect(DATA_RATE_LIMITS.bulk.limit).toBeLessThan(DATA_RATE_LIMITS.write.limit);
  });
});
