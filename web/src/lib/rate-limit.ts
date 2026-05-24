import { headers } from "next/headers";

// Upstash Redis-backed sliding-window rate limiting.
// Falls back to in-memory when UPSTASH_REDIS_REST_URL is not set (local dev).

// ---- Upstash path ----
type UpstashFn = (key: string, limit: number, windowMs: number) => Promise<{ success: boolean; error?: string }>;
let upstashFn: UpstashFn | null = null;
let upstashInitialized = false;

async function getUpstashFn(): Promise<UpstashFn | null> {
  if (upstashInitialized) return upstashFn;
  upstashInitialized = true;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    const { Ratelimit } = await import("@upstash/ratelimit");
    const { Redis } = await import("@upstash/redis");
    const redis = Redis.fromEnv();

    // Cache one Ratelimit instance per (limit, windowMs) config
    const limiterCache = new Map<string, InstanceType<typeof Ratelimit>>();

    upstashFn = async (key: string, limit: number, windowMs: number) => {
      const configKey = `${limit}:${windowMs}`;
      let limiter = limiterCache.get(configKey);
      if (!limiter) {
        limiter = new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(limit, `${windowMs}ms`),
          prefix: "berkepak_rl",
        });
        limiterCache.set(configKey, limiter);
      }
      const result = await limiter.limit(key);
      return { success: result.success };
    };
    return upstashFn;
  } catch {
    return null;
  }
}

// ---- In-memory fallback (single-instance only) ----
interface RateLimitRecord {
  timestamps: number[];
}
const cache = new Map<string, RateLimitRecord>();

if (typeof global !== "undefined") {
  const g = global as any;
  if (!g.__rateLimitCleanupInterval) {
    g.__rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of cache.entries()) {
        // Keep entries up to 1 hour — safe for all configured windows (max 5 min)
        record.timestamps = record.timestamps.filter((t) => now - t < 3600000);
        if (record.timestamps.length === 0) cache.delete(key);
      }
    }, 300000);
  }
}

function inMemoryCheck(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  let record = cache.get(key);
  if (!record) {
    record = { timestamps: [] };
    cache.set(key, record);
  }
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
  if (record.timestamps.length >= limit) return false;
  record.timestamps.push(now);
  return true;
}

// ---- Public API ----
export async function checkRateLimit(
  keyPrefix: string,
  limit: number,
  windowMs: number = 60000,
): Promise<{ success: boolean; error?: string }> {
  try {
    const headersList = await headers();
    const rawIp =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "127.0.0.1";
    const ip = rawIp.split(",")[0].trim();
    const key = `${keyPrefix}:${ip}`;

    const upstash = await getUpstashFn();
    if (upstash) {
      const result = await upstash(key, limit, windowMs);
      if (!result.success) {
        console.warn(`[RateLimit/Upstash] Blocked: ${key}`);
        return { success: false, error: "Too many requests. Please wait a moment and try again." };
      }
      return { success: true };
    }

    // Fallback: in-memory (single-instance only — not suitable for Vercel multi-instance)
    const allowed = inMemoryCheck(key, limit, windowMs);
    if (!allowed) {
      console.warn(`[RateLimit/InMemory] Blocked: ${key}`);
      return { success: false, error: "Too many requests. Please wait a moment and try again." };
    }
    return { success: true };
  } catch (err) {
    console.warn("[RateLimit] Error, bypassing:", err);
    return { success: true };
  }
}
