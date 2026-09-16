import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));

import { mockProvider, signMockPayload } from "@/lib/payments/providers/mock";
import { getProvider } from "@/lib/payments/registry";
import { PaymentConfigError } from "@/lib/payments/types";

const body = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    eventId: "evt_1",
    providerRef: "MOCK-ABC",
    status: "paid",
    ...over,
  });

describe("mock provider webhook verification", () => {
  it("accepts a correctly signed payload", async () => {
    const raw = body();
    const res = await mockProvider.verifyWebhook(raw, {
      "x-mock-signature": signMockPayload(raw),
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.eventId).toBe("evt_1");
      expect(res.providerRef).toBe("MOCK-ABC");
      expect(res.status).toBe("paid");
    }
  });

  it("rejects a tampered body under a valid-looking signature", async () => {
    const raw = body();
    const signature = signMockPayload(raw);
    // Same signature, different amount — the classic forgery attempt.
    const tampered = body({ status: "paid", extra: "tampered" });
    const res = await mockProvider.verifyWebhook(tampered, { "x-mock-signature": signature });
    expect(res.ok).toBe(false);
  });

  it("rejects a missing signature", async () => {
    const res = await mockProvider.verifyWebhook(body(), {});
    expect(res.ok).toBe(false);
  });

  it("rejects a signature of the wrong length without throwing", async () => {
    // timingSafeEqual throws on length mismatch if not guarded.
    const res = await mockProvider.verifyWebhook(body(), { "x-mock-signature": "short" });
    expect(res.ok).toBe(false);
  });

  it("rejects a body that is not JSON", async () => {
    const raw = "not-json";
    const res = await mockProvider.verifyWebhook(raw, {
      "x-mock-signature": signMockPayload(raw),
    });
    expect(res.ok).toBe(false);
  });

  it("rejects a payload missing required identifiers", async () => {
    const raw = JSON.stringify({ status: "paid" });
    const res = await mockProvider.verifyWebhook(raw, {
      "x-mock-signature": signMockPayload(raw),
    });
    expect(res.ok).toBe(false);
  });
});

describe("provider registry", () => {
  const original = process.env.NODE_ENV;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", original ?? "test");
    delete process.env.PAYMENTS_PROVIDER;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to the simulator outside production", () => {
    expect(getProvider().name).toBe("mock");
  });

  it("refuses the simulator in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.PAYMENTS_PROVIDER = "mock";
    expect(() => getProvider()).toThrow(PaymentConfigError);
  });

  it("throws on an unknown provider name", () => {
    expect(() => getProvider("does-not-exist")).toThrow(PaymentConfigError);
  });
});
