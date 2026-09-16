import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/db", () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
  transaction: vi.fn(),
  pool: {},
}));
vi.mock("@/lib/auth/guards", () => ({ getCurrentUser: vi.fn() }));
vi.mock("@/lib/storage", () => ({ putObject: vi.fn() }));

import { uploadReceipt } from "@/lib/actions/receipts";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { putObject } from "@/lib/storage";

const user = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "customer@berkepak.test",
  fullName: "Test User",
  phone: "03001234567",
  emailVerifiedAt: new Date(),
};

const bankOrder = { id: "BPK-1A2B3C4D", payment_method: "bank_transfer", payment_status: "awaiting_receipt" };

function form(over: { transactionId?: string } = {}) {
  const fd = new FormData();
  fd.set("orderId", bankOrder.id);
  fd.set("transactionId", over.transactionId ?? "mzn 2026 0915 7788");
  fd.set("file", new File([new Uint8Array([1, 2, 3])], "transfer.png", { type: "image/png" }));
  return fd;
}

describe("uploadReceipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue(user);
    vi.mocked(query).mockResolvedValue([]);
  });

  it("requires a transaction id", async () => {
    const res = await uploadReceipt(form({ transactionId: "" }));
    expect(res.ok).toBe(false);
    expect(putObject).not.toHaveBeenCalled();
  });

  it("refuses a transaction id already claimed by a live receipt", async () => {
    vi.mocked(queryOne)
      .mockResolvedValueOnce(bankOrder) // ownership
      .mockResolvedValueOnce({ taken: 1 }); // claim check
    const res = await uploadReceipt(form());
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already been submitted/) });
    expect(putObject).not.toHaveBeenCalled();
  });

  it("stores the id normalised, so spacing and case cannot dodge the uniqueness check", async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(bankOrder).mockResolvedValueOnce(null);
    const res = await uploadReceipt(form());
    expect(res.ok).toBe(true);

    const insert = vi.mocked(query).mock.calls.find(([sql]) => String(sql).includes("insert into receipts"));
    expect(insert?.[1]).toContain("MZN202609157788");
  });

  it("reports a lost uniqueness race as a duplicate, not a crash", async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(bankOrder).mockResolvedValueOnce(null);
    vi.mocked(query).mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));
    const res = await uploadReceipt(form());
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/already been submitted/) });
  });
});
