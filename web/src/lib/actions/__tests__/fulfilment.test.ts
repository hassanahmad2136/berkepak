import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: vi.fn(), isAdmin: vi.fn() }));
vi.mock("@/lib/actions/email-actions", () => ({ sendOrderShippedEmail: vi.fn() }));

import { advanceOrder, cancelOrder } from "@/lib/actions/fulfilment";
import { query, queryOne, transaction } from "@/lib/db";
import { isAdmin } from "@/lib/auth/guards";
import { sendOrderShippedEmail } from "@/lib/actions/email-actions";

const order = (over: Partial<Record<string, string>> = {}) => ({
  id: "BPK-1A2B3C4D",
  status: "fulfilled",
  payment_method: "online",
  payment_status: "paid",
  ...over,
});

const shipment = { courier: "TCS", trackingNumber: "TCS123456789" };

describe("advanceOrder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAdmin).mockResolvedValue(true);
    vi.mocked(query).mockResolvedValue([{ id: "BPK-1A2B3C4D" }]);
  });

  it("refuses a caller who is not an admin", async () => {
    vi.mocked(isAdmin).mockResolvedValue(false);
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res).toEqual({ ok: false, error: "Not an admin." });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses a skipped step", async () => {
    vi.mocked(queryOne).mockResolvedValue(order({ status: "confirmed" }));
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res).toMatchObject({ ok: false });
    expect(query).not.toHaveBeenCalled();
  });

  it("refuses to ship an unpaid bank transfer", async () => {
    vi.mocked(queryOne).mockResolvedValue(
      order({ payment_method: "bank_transfer", payment_status: "awaiting_review" }),
    );
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/not paid/i) });
    expect(query).not.toHaveBeenCalled();
  });

  it("ships an unpaid cash-on-delivery order, which is paid at the door", async () => {
    vi.mocked(queryOne).mockResolvedValue(
      order({ payment_method: "cod", payment_status: "pending" }),
    );
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res.ok).toBe(true);
  });

  it("refuses to ship without a tracking number", async () => {
    vi.mocked(queryOne).mockResolvedValue(order());
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", { courier: "TCS", trackingNumber: "  " });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/tracking number/i) });
    expect(query).not.toHaveBeenCalled();
  });

  it("records courier and tracking, and emails the customer", async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(order())
      .mockResolvedValueOnce({ email: "customer@example.test" });
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res.ok).toBe(true);

    const [sql, params] = vi.mocked(query).mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/status = 'shipped'/);
    // The update only matches the status it read, so a concurrent move wins.
    expect(params).toEqual(["BPK-1A2B3C4D", "TCS", "TCS123456789", "fulfilled"]);
    expect(sendOrderShippedEmail).toHaveBeenCalledWith("BPK-1A2B3C4D", "customer@example.test");
  });

  it("reports a lost race instead of silently doing nothing", async () => {
    vi.mocked(queryOne).mockResolvedValue(order());
    vi.mocked(query).mockResolvedValue([]);
    const res = await advanceOrder("BPK-1A2B3C4D", "shipped", shipment);
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already moved on/i) });
    expect(sendOrderShippedEmail).not.toHaveBeenCalled();
  });
});

describe("cancelOrder", () => {
  let statements: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAdmin).mockResolvedValue(true);
    statements = [];
  });

  function withCancelRows(rowCount: number) {
    vi.mocked(transaction).mockImplementation((async (fn: (c: unknown) => unknown) =>
      fn({
        query: vi.fn(async (sql: string) => {
          statements.push(sql);
          return sql.includes("update orders")
            ? { rowCount, rows: rowCount ? [{ id: "BPK-1A2B3C4D" }] : [] }
            : { rowCount: 1, rows: [] };
        }),
      })) as never);
  }

  it("refuses to cancel an order the courier already has", async () => {
    vi.mocked(queryOne).mockResolvedValue(order({ status: "shipped" }));
    const res = await cancelOrder("BPK-1A2B3C4D", "Customer changed their mind");
    expect(res).toMatchObject({ ok: false });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("requires a reason", async () => {
    vi.mocked(queryOne).mockResolvedValue(order({ status: "confirmed" }));
    const res = await cancelOrder("BPK-1A2B3C4D", "   ");
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/reason/i) });
  });

  it("cancels and returns the stock in one transaction", async () => {
    vi.mocked(queryOne).mockResolvedValue(order({ status: "confirmed" }));
    withCancelRows(1);
    const res = await cancelOrder("BPK-1A2B3C4D", "Out of stock in this colour");
    expect(res.ok).toBe(true);
    expect(statements.some((s) => s.includes("restock_order_items"))).toBe(true);
  });

  it("does not restock an order that was already cancelled", async () => {
    vi.mocked(queryOne).mockResolvedValue(order({ status: "confirmed" }));
    withCancelRows(0);
    const res = await cancelOrder("BPK-1A2B3C4D", "Double click");
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already cancelled/i) });
    expect(statements.some((s) => s.includes("restock_order_items"))).toBe(false);
  });
});
