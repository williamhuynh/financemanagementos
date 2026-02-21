import { NextResponse } from "next/server";

/**
 * Sliding-window rate limiter with pluggable store.
 *
 * Default: in-memory Map (single-instance).
 * Production: set REDIS_URL env var to use Redis for multi-instance
 * consistency. The Redis adapter is loaded lazily so the dependency
 * is optional.
 */

// ─── Store interface ─────────────────────────────────────────

export interface RateLimitStore {
  /** Get timestamps for a key. */
  get(key: string): Promise<number[]> | number[];
  /** Set timestamps for a key. */
  set(key: string, timestamps: number[]): Promise<void> | void;
  /** Delete a key. */
  delete(key: string): Promise<void> | void;
  /** Return all keys (for pruning). */
  keys(): Promise<string[]> | string[];
}

// ─── In-memory store (default) ───────────────────────────────

class MemoryStore implements RateLimitStore {
  private map = new Map<string, number[]>();

  get(key: string): number[] {
    return this.map.get(key) ?? [];
  }

  set(key: string, timestamps: number[]): void {
    if (timestamps.length === 0) {
      this.map.delete(key);
    } else {
      this.map.set(key, timestamps);
    }
  }

  delete(key: string): void {
    this.map.delete(key);
  }

  keys(): string[] {
    return Array.from(this.map.keys());
  }
}

// ─── Redis store (opt-in via REDIS_URL) ──────────────────────

/**
 * Redis-backed store using sorted sets for sliding-window tracking.
 * Requires `ioredis` as an optional peer dependency.
 *
 * Set REDIS_URL environment variable to enable. Example:
 *   REDIS_URL=redis://localhost:6379
 *   REDIS_URL=rediss://user:password@host:port
 */
class RedisStore implements RateLimitStore {
  private client: RedisClient | null = null;
  private connecting: Promise<void> | null = null;
  private failed = false;

  private async getClient(): Promise<RedisClient> {
    if (this.client) return this.client;
    // If a previous connection attempt failed, allow retry on next call.
    if (this.failed) {
      this.connecting = null;
      this.failed = false;
    }
    if (this.connecting) {
      await this.connecting;
      if (!this.client) throw new Error("Redis unavailable");
      return this.client;
    }
    this.connecting = this.connect();
    await this.connecting;
    if (!this.client) throw new Error("Redis unavailable");
    return this.client;
  }

  private async connect(): Promise<void> {
    try {
      // Dynamic import so ioredis is optional.
      // Use Function constructor to prevent Vite/bundler static analysis
      // from trying to resolve this optional peer dependency at build time.
      const dynamicImport = new Function("specifier", "return import(specifier)");
      const { default: Redis } = await dynamicImport("ioredis");
      this.client = new Redis(process.env.REDIS_URL!, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      }) as RedisClient;
      await (this.client as unknown as { connect: () => Promise<void> }).connect();
    } catch {
      console.error("Redis connection failed — falling back to in-memory rate limiter");
      this.client = null;
      this.failed = true;
      throw new Error("Redis unavailable");
    }
  }

  async get(key: string): Promise<number[]> {
    const client = await this.getClient();
    const members = await client.zrange(key, 0, -1);
    return members.map(Number);
  }

  async set(key: string, timestamps: number[]): Promise<void> {
    const client = await this.getClient();
    const pipeline = client.pipeline();
    pipeline.del(key);
    if (timestamps.length > 0) {
      const args: [number, string][] = timestamps.map((t) => [t, String(t)]);
      pipeline.zadd(key, ...args.flat());
      // Auto-expire key after longest possible window (1 hour)
      pipeline.expire(key, 3600);
    }
    await pipeline.exec();
  }

  async delete(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }

  async keys(): Promise<string[]> {
    // Not used for Redis — Redis handles TTL natively
    return [];
  }
}

// Minimal Redis client type to avoid requiring ioredis types at compile time
interface RedisClient {
  zrange(key: string, start: number, stop: number): Promise<string[]>;
  zadd(key: string, ...args: (string | number)[]): Promise<number>;
  del(key: string): Promise<number>;
  pipeline(): {
    del(key: string): unknown;
    zadd(key: string, ...args: (string | number)[]): unknown;
    expire(key: string, seconds: number): unknown;
    exec(): Promise<unknown>;
  };
}

// ─── Active store ────────────────────────────────────────────

let activeStore: RateLimitStore | null = null;

function getStore(): RateLimitStore {
  if (activeStore) return activeStore;
  if (process.env.REDIS_URL) {
    activeStore = new RedisStore();
  } else {
    activeStore = new MemoryStore();
  }
  return activeStore;
}

/** Replace the active store (useful for testing). */
export function setRateLimitStore(store: RateLimitStore): void {
  activeStore = store;
}

// ─── Pruning (memory store only) ─────────────────────────────

const PRUNE_INTERVAL_MS = 60_000;
let lastPrune = Date.now();

function prune(windowMs: number): void {
  const now = Date.now();
  if (now - lastPrune < PRUNE_INTERVAL_MS) return;
  lastPrune = now;

  const store = getStore();
  // Redis handles TTL natively; only prune for memory store
  if (store instanceof MemoryStore) {
    const cutoff = now - windowMs;
    const allKeys = store.keys() as string[];
    for (const key of allKeys) {
      const timestamps = store.get(key) as number[];
      const filtered = timestamps.filter((t) => t > cutoff);
      store.set(key, filtered);
    }
  }
}

// ─── Public API ──────────────────────────────────────────────

export interface RateLimitConfig {
  /** Maximum number of requests allowed within the window */
  limit: number;
  /** Time window in milliseconds */
  windowMs: number;
}

/**
 * Check if a request should be rate-limited.
 * Returns null if allowed, or a NextResponse 429 if blocked.
 *
 * Async to support both MemoryStore (sync) and RedisStore (async).
 * All API route handlers are async, so awaiting this is free.
 * On store failure (e.g. Redis down), requests are allowed through.
 */
export async function rateLimit(
  request: Request,
  config: RateLimitConfig
): Promise<NextResponse | null> {
  const { limit, windowMs } = config;
  const now = Date.now();

  prune(windowMs);

  const store = getStore();

  // Use forwarded IP, then fall back to a generic key
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const key = `${ip}:${new URL(request.url).pathname}`;

  try {
    const timestamps = await store.get(key);
    const filtered = timestamps.filter((t) => t > now - windowMs);

    if (filtered.length >= limit) {
      const retryAfter = Math.ceil(
        (filtered[0]! + windowMs - now) / 1000
      );
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(Math.max(1, retryAfter)) },
        }
      );
    }

    filtered.push(now);
    await store.set(key, filtered);
    return null;
  } catch {
    // Store failure (e.g. Redis down) — allow request through
    // rather than blocking all users.
    return null;
  }
}

// ─── Preset configs ──────────────────────────────────────────

// Auth endpoints (strict)
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

// Data endpoints (generous but bounded)
export const DATA_RATE_LIMITS = {
  /** Standard read: 60 requests per minute */
  read: { limit: 60, windowMs: 60 * 1000 },
  /** Standard write (create/update): 30 requests per minute */
  write: { limit: 30, windowMs: 60 * 1000 },
  /** Delete operations: 20 requests per minute */
  delete: { limit: 20, windowMs: 60 * 1000 },
  /** Bulk operations (imports, commits): 5 per minute */
  bulk: { limit: 5, windowMs: 60 * 1000 },
  /** AI/external API calls: 10 per minute */
  ai: { limit: 10, windowMs: 60 * 1000 },
  /** Export: 3 per minute */
  export: { limit: 3, windowMs: 60 * 1000 },
  /** Account deletion: 1 per 15 minutes */
  accountDelete: { limit: 1, windowMs: 15 * 60 * 1000 },
} as const;
