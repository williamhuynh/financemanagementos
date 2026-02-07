import { NextResponse } from "next/server";

/**
 * Simple in-memory sliding-window rate limiter.
 * Tracks request timestamps per key (IP address) and rejects
 * requests that exceed the configured limit within the window.
 *
 * Suitable for single-instance deployments. For multi-instance,
 * swap the Map for Redis or similar.
 */

type RateLimitEntry = { timestamps: number[] };

const store = new Map<string, RateLimitEntry>();

// Periodically prune stale entries to prevent unbounded memory growth
const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

function prune(windowMs: number) {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;
  const cutoff = now - windowMs;
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) store.delete(key);
  }
}

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Check if a request should be rate-limited.
 * Returns null if allowed, or a NextResponse 429 if blocked.
 */
export function rateLimit(
  request: Request,
  config: RateLimitConfig
): NextResponse | null {
  const { limit, windowMs } = config;
  const now = Date.now();

  prune(windowMs);

  // Use forwarded IP, then fall back to a generic key
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${new URL(request.url).pathname}`;

  const entry = store.get(key) ?? { timestamps: [] };

  // Drop timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => t > now - windowMs);

  if (entry.timestamps.length >= limit) {
    const retryAfter = Math.ceil(
      (entry.timestamps[0]! + windowMs - now) / 1000
    );
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
        },
      }
    );
  }

  entry.timestamps.push(now);
  store.set(key, entry);

  return null;
}

// Preset configs for auth endpoints
export const AUTH_RATE_LIMITS = {
  /** Login: 5 attempts per 15 minutes */
  login: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Signup: 3 attempts per 15 minutes */
  signup: { limit: 3, windowMs: 15 * 60 * 1000 },
  /** Forgot password: 3 attempts per 15 minutes */
  forgotPassword: { limit: 3, windowMs: 15 * 60 * 1000 },
  /** Reset password: 5 attempts per 15 minutes */
  resetPassword: { limit: 5, windowMs: 15 * 60 * 1000 },
  /** Invitation verify/accept: 10 attempts per 15 minutes */
  invitation: { limit: 10, windowMs: 15 * 60 * 1000 },
} as const;
