import { describe, it, expect, vi, beforeEach } from "vitest";

// checkRateLimit reaches for request headers.
vi.mock("next/headers", () => ({
  headers: vi.fn(() => ({ get: vi.fn(() => "127.0.0.1") })),
}));

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));

// Controlled so limits fire deterministically rather than via in-memory state.
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  checkRateLimitByKey: vi.fn(),
}));

import { verifyOtp, sendOtp } from "@/lib/actions/otp";
import { query, queryOne } from "@/lib/db";
import { checkRateLimit, checkRateLimitByKey } from "@/lib/rate-limit";

const mockQuery = vi.mocked(query);
const mockQueryOne = vi.mocked(queryOne);
const mockCheckRateLimit = vi.mocked(checkRateLimit);
const mockCheckRateLimitByKey = vi.mocked(checkRateLimitByKey);

const future = () => new Date(Date.now() + 600_000);
const past = () => new Date(Date.now() - 60_000);

describe("verifyOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockQuery.mockResolvedValue([]);
  });

  it("rejects an expired code", async () => {
    mockQueryOne.mockResolvedValue({
      id: "otp-1",
      code: "1234",
      attempts: 0,
      expires_at: past(),
      consumed_at: null,
    });

    const result = await verifyOtp("+921234567890", "1234");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it("rejects a code that was already consumed", async () => {
    mockQueryOne.mockResolvedValue({
      id: "otp-2",
      code: "5678",
      attempts: 0,
      expires_at: future(),
      consumed_at: new Date(),
    });

    const result = await verifyOtp("+921234567890", "5678");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already used/i);
  });

  it("locks out after the attempt ceiling", async () => {
    mockQueryOne.mockResolvedValue({
      id: "otp-3",
      code: "9999",
      attempts: 5,
      expires_at: future(),
      consumed_at: null,
    });

    const result = await verifyOtp("+921234567890", "9999");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many attempts/i);
  });

  it("counts a wrong code as an attempt without consuming it", async () => {
    mockQueryOne.mockResolvedValue({
      id: "otp-4",
      code: "4321",
      attempts: 1,
      expires_at: future(),
      consumed_at: null,
    });

    const result = await verifyOtp("+921234567890", "0000");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/incorrect/i);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("attempts = attempts + 1"),
      ["otp-4"],
    );
  });

  it("accepts a valid code and consumes it", async () => {
    mockQueryOne.mockResolvedValue({
      id: "otp-5",
      code: "4321",
      attempts: 0,
      expires_at: future(),
      consumed_at: null,
    });

    const result = await verifyOtp("+921234567890", "4321");
    expect(result.ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("consumed_at = now()"),
      ["otp-5"],
    );
  });

  it("reports when no code was ever requested", async () => {
    mockQueryOne.mockResolvedValue(null);
    const result = await verifyOtp("+921234567890", "1234");
    expect(result.ok).toBe(false);
  });

  it("refuses once the rate limit trips", async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, error: "Too many requests." });
    const result = await verifyOtp("+921234567890", "1234");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});

describe("sendOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockResolvedValue({ success: true });
    mockCheckRateLimitByKey.mockResolvedValue({ success: true });
    mockQuery.mockResolvedValue([]);
    mockQueryOne.mockResolvedValue(null); // no code collision
  });

  it("rejects a malformed email address", async () => {
    const result = await sendOtp("not-an-email", "email");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid email/i);
  });

  it("rejects a malformed phone number", async () => {
    const result = await sendOtp("abc", "whatsapp");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/invalid phone/i);
  });

  it("stores the code against the destination column", async () => {
    const result = await sendOtp("customer@berkepak.test", "email");
    expect(result.ok).toBe(true);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("insert into otp_codes (destination"),
      expect.arrayContaining(["customer@berkepak.test", "email"]),
    );
  });

  it("honours the per-destination rate limit", async () => {
    mockCheckRateLimitByKey.mockResolvedValue({
      success: false,
      error: "Too many OTP requests.",
    });
    const result = await sendOtp("customer@berkepak.test", "email");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too many/i);
  });
});
