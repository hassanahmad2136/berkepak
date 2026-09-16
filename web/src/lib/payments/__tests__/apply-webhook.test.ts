import { describe, it, expect, beforeEach, vi } from "vitest";
import crypto from "crypto";

vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));
vi.mock("@/lib/actions/email-actions", () => ({ sendPaymentConfirmedEmail: vi.fn() }));

process.env.PAYFAST_MERCHANT_ID = "102";
process.env.PAYFAST_SECURED_KEY = "test-secured-key";

import { applyWebhook } from "@/lib/payments/service";
import { transaction } from "@/lib/db";

const BASKET = "BPK-1A2B3C4D-00FF";

const callback = (amount: string) =>
  new URLSearchParams({
    basket_id: BASKET,
    err_code: "000",
    transaction_id: `TXN-${amount}`,
    transaction_amount: amount,
    validation_hash: crypto
      .createHash("sha256")
      .update(`${BASKET}|test-secured-key|102|000`)
      .digest("hex"),
  }).toString();

/** A transaction client that records every statement and plays back fixed rows. */
function fakeClient(opts: { claimed?: boolean } = {}) {
  const statements: Array<{ sql: string; params: unknown[] }> = [];
  const client = {
    query: vi.fn(async (sql: string, params: unknown[] = []) => {
      statements.push({ sql, params });
      if (sql.includes("insert into payment_events")) {
        return opts.claimed === false
          ? { rowCount: 0, rows: [] }
          : { rowCount: 1, rows: [{ id: "event-row" }] };
      }
      if (sql.includes("from payments")) {
        return {
          rowCount: 1,
          rows: [{ id: "pay-1", order_id: "BPK-1A2B3C4D", status: "pending", amount: "4970.00" }],
        };
      }
      return { rowCount: 1, rows: [] };
    }),
  };
  return { client, statements };
}

describe("applyWebhook", () => {
  let fake: ReturnType<typeof fakeClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    fake = fakeClient();
    vi.mocked(transaction).mockImplementation((async (fn: (c: unknown) => unknown) =>
      fn(fake.client)) as never);
  });

  const markedPaid = () =>
    fake.statements.some((s) => s.sql.includes("payment_status = 'paid'"));

  it("marks the order paid when the gateway reports the full amount", async () => {
    const outcome = await applyWebhook("payfast", callback("4970"), {});
    expect(outcome).toMatchObject({ ok: true, applied: true, status: "paid" });
    expect(markedPaid()).toBe(true);
  });

  it("holds an underpayment for review instead of marking it paid", async () => {
    const outcome = await applyWebhook("payfast", callback("4800"), {});
    expect(outcome).toMatchObject({ ok: true, applied: true, status: "pending" });
    expect(markedPaid()).toBe(false);

    const update = fake.statements.find((s) => s.sql.includes("update payments set status"));
    expect(update?.params[0]).toBe("pending");
    expect(String(update?.params[1])).toMatch(/held for review/i);
  });

  it("changes nothing on a redelivered event", async () => {
    fake = fakeClient({ claimed: false });
    const outcome = await applyWebhook("payfast", callback("4970"), {});
    expect(outcome).toMatchObject({ ok: true, applied: false });
    expect(markedPaid()).toBe(false);
  });

  it("rejects a forged callback before touching the database", async () => {
    const forged = new URLSearchParams(callback("4970"));
    forged.set("validation_hash", "0".repeat(64));
    const outcome = await applyWebhook("payfast", forged.toString(), {});
    expect(outcome.ok).toBe(false);
    expect(transaction).not.toHaveBeenCalled();
  });
});
