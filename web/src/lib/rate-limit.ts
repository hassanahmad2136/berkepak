import { headers } from "next/headers";

interface RateLimitRecord {
  timestamps: number[];
}

// In-memory cache map to hold IP rate limit timestamps
const cache = new Map<string, RateLimitRecord>();

// Clean up old entries every 5 minutes to avoid memory leaks
if (typeof global !== "undefined") {
  const globalAny = global as any;
  if (!globalAny.__rateLimitCleanupInterval) {
    globalAny.__rateLimitCleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, record] of cache.entries()) {
        // Keep only timestamps within the last 1 minute
        record.timestamps = record.timestamps.filter((t) => now - t < 60000);
        if (record.timestamps.length === 0) {
          cache.delete(key);
        }
      }
    }, 300000);
  }
}

/**
 * Check if the current request exceeds the rate limit.
 * Keyed by a specific prefix (e.g. "otp", "checkout") and the client's IP.
 * 
 * @param keyPrefix - Category name for logging/indexing
 * @param limit     - Max allowed requests within windowMs
 * @param windowMs  - Time window in milliseconds (default 60000ms / 1 min)
 * @returns { success: boolean, error?: string }
 */
export async function checkRateLimit(
  keyPrefix: string,
  limit: number,
  windowMs: number = 60000,
): Promise<{ success: boolean; error?: string }> {
  try {
    const headersList = await headers();
    // Safely extract client IP, fallback to local loopback
    const rawIp = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "127.0.0.1";
    const ip = rawIp.split(",")[0].trim();
    
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();
    
    let record = cache.get(key);
    if (!record) {
      record = { timestamps: [] };
      cache.set(key, record);
    }
    
    // Filter timestamps to only keep ones inside the current window
    record.timestamps = record.timestamps.filter((t) => now - t < windowMs);
    
    if (record.timestamps.length >= limit) {
      console.warn(`[RateLimit] Blocked request for ${key}. Count: ${record.timestamps.length}/${limit}`);
      return {
        success: false,
        error: "Too many requests. Please wait a moment and try again.",
      };
    }
    
    record.timestamps.push(now);
    return { success: true };
  } catch (err) {
    // If headers or other environment states fail (e.g. static generation compile time), bypass rate limiting gracefully
    console.warn("[RateLimit] Error executing check, passing request:", err);
    return { success: true };
  }
}
