import { describe, it, expect, afterEach, vi } from "vitest";
import crypto from "crypto";

process.env.PAYFAST_MERCHANT_ID = "102";
process.env.PAYFAST_SECURED_KEY = "test-secured-key";

import { payFastProvider } from "@/lib/payments/providers/payfast";

// Computed independently of the adapter, so a change to its formula fails here.
const hash = (basketId: string, errCode: string) =>
  crypto
    .createHash("sha256")
    .update(`${basketId}|test-secured-key|102|${errCode}`)
    .digest("hex");

const callback = (over: Record<string, string> = {}) =>
  new URLSearchParams({
    basket_id: "BPK-1A2B3C4D-00FF",
    err_code: "000",
    err_msg: "Transaction has been completed.",
    transaction_id: "TXN-991",
    transaction_amount: "4970",
    validation_hash: hash("BPK-1A2B3C4D-00FF", "000"),
    ...over,
  }).toString();

describe("PayFast callback verification", () => {
  it("accepts an approved callback and reports the amount", async () => {
    const res = await payFastProvider.verifyWebhook(callback(), {});
    expect(res).toMatchObject({
      ok: true,
      providerRef: "BPK-1A2B3C4D-00FF",
      status: "paid",
      amountPKR: 4970,
      eventId: "TXN-991:000",
    });
  });

  it("records a declined result as failed with PayFast's reason", async () => {
    const res = await payFastProvider.verifyWebhook(
      callback({
        err_code: "002",
        err_msg: "Insufficient balance",
        validation_hash: hash("BPK-1A2B3C4D-00FF", "002"),
      }),
      {},
    );
    expect(res).toMatchObject({ ok: true, status: "failed", failureReason: "Insufficient balance" });
  });

  it("rejects a declined result rewritten as approved without the secret", async () => {
    // The forgery that matters: flip err_code to success, keep the old hash.
    const res = await payFastProvider.verifyWebhook(
      callback({ err_code: "000", validation_hash: hash("BPK-1A2B3C4D-00FF", "002") }),
      {},
    );
    expect(res.ok).toBe(false);
  });

  it("rejects a hash moved onto another basket", async () => {
    const res = await payFastProvider.verifyWebhook(callback({ basket_id: "BPK-FFFFFFFF-0000" }), {});
    expect(res.ok).toBe(false);
  });

  it("rejects a callback with no hash, and one of the wrong length, without throwing", async () => {
    const params = new URLSearchParams(callback());
    params.delete("validation_hash");
    expect((await payFastProvider.verifyWebhook(params.toString(), {})).ok).toBe(false);
    expect((await payFastProvider.verifyWebhook(callback({ validation_hash: "abc" }), {})).ok).toBe(
      false,
    );
  });

  it("accepts an upper-case hash and a JSON body", async () => {
    const upper = await payFastProvider.verifyWebhook(
      callback({ validation_hash: hash("BPK-1A2B3C4D-00FF", "000").toUpperCase() }),
      {},
    );
    expect(upper.ok).toBe(true);

    const json = await payFastProvider.verifyWebhook(
      JSON.stringify(Object.fromEntries(new URLSearchParams(callback()))),
      {},
    );
    expect(json.ok).toBe(true);
  });
});

describe("PayFast initiate", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("binds the token to basket and amount, and hands the browser a form to post", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ACCESS_TOKEN: "tok-123" }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await payFastProvider.initiate({
      orderId: "BPK-1A2B3C4D",
      amountPKR: 4970,
      method: "hosted_checkout",
      customer: { email: "c@example.com", phone: "03001234567" },
      returnUrl: "https://shop.example/order/BPK-1A2B3C4D",
      origin: "https://shop.example",
    });

    const [tokenUrl, tokenInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(tokenUrl).toBe("https://ipguat.apps.net.pk/Ecommerce/api/Transaction/GetAccessToken");
    const sent = new URLSearchParams(String(tokenInit.body));
    expect(sent.get("BASKET_ID")).toBe(result.providerRef);
    expect(sent.get("TXNAMT")).toBe("4970");

    expect(result.providerRef).toMatch(/^BPK-1A2B3C4D-[0-9A-F]{8}$/);
    expect(result.redirectUrl).toBe(`https://shop.example/pay/payfast/${result.providerRef}`);

    const raw = result.raw as { action: string; fields: Record<string, string> };
    expect(raw.action).toBe("https://ipguat.apps.net.pk/Ecommerce/api/Transaction/PostTransaction");
    expect(raw.fields).toMatchObject({
      TOKEN: "tok-123",
      BASKET_ID: result.providerRef,
      TXNAMT: "4970",
      CHECKOUT_URL: "https://shop.example/api/payments/webhook/payfast",
      SUCCESS_URL: "https://shop.example/api/payments/return/payfast",
    });
    // The secured key authenticates us to PayFast; it must never reach a browser.
    expect(JSON.stringify(raw)).not.toContain("test-secured-key");
  });

  it("throws rather than sending a customer to PayFast without a token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    await expect(
      payFastProvider.initiate({
        orderId: "BPK-1",
        amountPKR: 100,
        method: "hosted_checkout",
        customer: { email: "c@example.com" },
        returnUrl: "https://shop.example/order/BPK-1",
        origin: "https://shop.example",
      }),
    ).rejects.toThrow(/token/i);
  });
});
