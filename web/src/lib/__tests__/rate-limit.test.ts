import { describe, it, expect, beforeEach } from "vitest";

// Ensure no Upstash env vars are set — forces in-memory fallback
delete process.env.UPSTASH_REDIS_REST_URL;
delete process.env.UPSTASH_REDIS_REST_TOKEN;

// We need to reset the module between tests to get a fresh cache,
// but the module uses a module-level Map. We work around this by
// using unique keys per test so we don't share state.
import { checkRateLimitByKey } from "@/lib/rate-limit";

describe("checkRateLimitByKey — in-memory fallback", () => {
  // Use a unique key prefix per describe block to avoid cross-test pollution
  const keyPrefix = `test_rl_${Date.now()}`;

  it("returns { success: true } on first call", async () => {
    const result = await checkRateLimitByKey(`${keyPrefix}_t1`, 3, 60000);
    expect(result.success).toBe(true);
  });

  it("returns { success: false } after limit is exceeded", async () => {
    const key = `${keyPrefix}_t2`;
    const limit = 3;

    // Exhaust the limit
    for (let i = 0; i < limit; i++) {
      const r = await checkRateLimitByKey(key, limit, 60000);
      expect(r.success).toBe(true);
    }

    // The (limit+1)th call should be blocked
    const blocked = await checkRateLimitByKey(key, limit, 60000);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBeDefined();
    expect(blocked.error).toMatch(/too many requests/i);
  });

  it("uses the key as-is — different IPs do not get separate buckets", async () => {
    // checkRateLimitByKey does NOT append any IP — contrast with checkRateLimit
    // which appends the request IP. Both calls below use the same key so they
    // share the same rate-limit bucket regardless of who is calling.
    const key = `${keyPrefix}_t3`;
    const limit = 2;

    // First call — allowed
    const r1 = await checkRateLimitByKey(key, limit, 60000);
    expect(r1.success).toBe(true);

    // Second call with the same key (simulating a different "IP") — still allowed (limit = 2)
    const r2 = await checkRateLimitByKey(key, limit, 60000);
    expect(r2.success).toBe(true);

    // Third call — blocked, proving both previous calls counted against the same bucket
    const r3 = await checkRateLimitByKey(key, limit, 60000);
    expect(r3.success).toBe(false);
  });
});
