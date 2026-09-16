import "server-only";
import crypto from "crypto";
import { SITE } from "@/lib/site";
import {
  PaymentConfigError,
  type InitiateInput,
  type InitiateResult,
  type PaymentProvider,
  type WebhookVerification,
} from "../types";

/**
 * PayFast (Pakistan) hosted checkout.
 *
 *   1. Server asks for a one-time ACCESS_TOKEN bound to this basket and amount.
 *   2. The customer's browser POSTs a form to PayFast's hosted page, where
 *      they pay by card, wallet or bank account.
 *   3. PayFast calls CHECKOUT_URL server-to-server and sends the browser to
 *      SUCCESS_URL or FAILURE_URL. Both carry err_code and a validation_hash.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ PARTLY UNVERIFIED — check the three marked blocks before going live.     │
 * │                                                                          │
 * │ The token and PostTransaction endpoints and form field names match the   │
 * │ UAT URLs and the field set public PayFast SDKs send. The callback hash   │
 * │ formula and the status inquiry call could not be confirmed: PayFast's    │
 * │ API reference (gopayfast.com/docs) refuses automated access. Check them  │
 * │ against the integration guide PayFast issues with merchant credentials.  │
 * │ Nothing outside this file needs to change.                               │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

interface PayFastConfig {
  baseUrl: string;
  merchantId: string;
  securedKey: string;
  merchantName: string;
}

/** PayFast's UAT host. Live credentials come with the production host. */
const UAT_BASE_URL = "https://ipguat.apps.net.pk";

function config(): PayFastConfig {
  const merchantId = process.env.PAYFAST_MERCHANT_ID;
  const securedKey = process.env.PAYFAST_SECURED_KEY;
  if (!merchantId || !securedKey) {
    throw new PaymentConfigError(
      "PayFast is not configured. Set PAYFAST_MERCHANT_ID and PAYFAST_SECURED_KEY.",
    );
  }
  return {
    baseUrl: (process.env.PAYFAST_BASE_URL || UAT_BASE_URL).replace(/\/$/, ""),
    merchantId,
    securedKey,
    merchantName: process.env.PAYFAST_MERCHANT_NAME || SITE.brand,
  };
}

/** err_code values PayFast uses for an approved transaction. */
const SUCCESS_CODES = new Set(["000", "00"]);

async function getAccessToken(
  cfg: PayFastConfig,
  basket?: { id: string; amountPKR: number },
): Promise<string> {
  const form = new URLSearchParams({
    MERCHANT_ID: cfg.merchantId,
    SECURED_KEY: cfg.securedKey,
  });
  if (basket) {
    // Binding the token to basket and amount is what stops a customer editing
    // TXNAMT in the browser form before it reaches PayFast.
    form.set("BASKET_ID", basket.id);
    form.set("TXNAMT", String(basket.amountPKR));
    form.set("CURRENCY_CODE", "PKR");
  }

  const res = await fetch(`${cfg.baseUrl}/Ecommerce/api/Transaction/GetAccessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: form.toString(),
  });
  const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const token = typeof raw.ACCESS_TOKEN === "string" ? raw.ACCESS_TOKEN : null;
  if (!res.ok || !token) {
    throw new Error(`PayFast token request failed (${res.status}).`);
  }
  return token;
}

/**
 * ── VERIFY (2/3): callback hash ────────────────────────────────────────────
 * Assumed SHA-256 hex of basket_id|secured_key|merchant_id|err_code. It covers
 * the result code but not the amount, which is why the amount is checked
 * separately in the payments service.
 */
export function payfastValidationHash(
  basketId: string,
  errCode: string,
  cfg: Pick<PayFastConfig, "merchantId" | "securedKey"> = config(),
): string {
  return crypto
    .createHash("sha256")
    .update(`${basketId}|${cfg.securedKey}|${cfg.merchantId}|${errCode}`)
    .digest("hex");
}

/** PayFast's own timestamp format, in its own timezone. */
function karachiTimestamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${part("year")}-${part("month")}-${part("day")} ${part("hour")}:${part("minute")}:${part("second")}`;
}

/** Callback fields, keyed case-insensitively: GET query, form body or JSON. */
function readPayload(rawBody: string): Map<string, string> | null {
  const fields = new Map<string, string>();
  const trimmed = rawBody.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== null && value !== undefined) fields.set(key.toLowerCase(), String(value));
      }
    } catch {
      return null;
    }
  } else {
    for (const [key, value] of new URLSearchParams(trimmed)) {
      fields.set(key.toLowerCase(), value);
    }
  }
  return fields;
}

export const payFastProvider: PaymentProvider = {
  name: "payfast",
  displayName: "PayFast",
  supports: ["hosted_checkout"],

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const cfg = config();

    // One basket per attempt: a customer who abandons PayFast and retries gets
    // a fresh basket, and each attempt keeps its own reference and status.
    const basketId = `${input.orderId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const token = await getAccessToken(cfg, { id: basketId, amountPKR: input.amountPKR });

    // ── VERIFY (1/3): hosted checkout form fields ───────────────────────────
    const fields: Record<string, string> = {
      MERCHANT_ID: cfg.merchantId,
      MERCHANT_NAME: cfg.merchantName,
      TOKEN: token,
      PROCCODE: "00",
      TXNAMT: String(input.amountPKR),
      CURRENCY_CODE: "PKR",
      CUSTOMER_MOBILE_NO: input.customer.phone ?? "",
      CUSTOMER_EMAIL_ADDRESS: input.customer.email,
      // Merchant-side reference PayFast echoes back; not a security control.
      SIGNATURE: crypto
        .createHash("md5")
        .update(`${cfg.merchantId}:${cfg.merchantName}:${input.amountPKR}:${basketId}`)
        .digest("hex"),
      VERSION: "BERKEPAK-1.0",
      TXNDESC: `Order ${input.orderId}`,
      SUCCESS_URL: `${input.origin}/api/payments/return/payfast`,
      FAILURE_URL: `${input.origin}/api/payments/return/payfast`,
      CHECKOUT_URL: `${input.origin}/api/payments/webhook/payfast`,
      BASKET_ID: basketId,
      ORDER_DATE: karachiTimestamp(),
      TRAN_TYPE: "ECOMM_PURCHASE",
    };

    return {
      providerRef: basketId,
      status: "pending",
      // PayFast takes a form POST, not a link, so the customer goes via a page
      // of ours that submits the form. See app/pay/payfast/[ref].
      redirectUrl: `${input.origin}/pay/payfast/${encodeURIComponent(basketId)}`,
      raw: {
        action: `${cfg.baseUrl}/Ecommerce/api/Transaction/PostTransaction`,
        fields,
      },
    };
  },

  async verifyWebhook(rawBody): Promise<WebhookVerification> {
    const cfg = config();
    const fields = readPayload(rawBody);
    if (!fields) return { ok: false, reason: "Body is not valid JSON." };

    const basketId = fields.get("basket_id");
    const errCode = fields.get("err_code");
    const provided = fields.get("validation_hash");
    if (!basketId || !errCode || !provided) {
      return { ok: false, reason: "Missing basket_id, err_code or validation_hash." };
    }

    const expected = payfastValidationHash(basketId, errCode, cfg);
    // Constant-time compare: a fast-exit compare leaks the hash byte by byte.
    const a = Buffer.from(provided.toLowerCase());
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "Validation hash mismatch." };
    }

    const paid = SUCCESS_CODES.has(errCode);
    const amount = Number(fields.get("transaction_amount"));
    const transactionId = fields.get("transaction_id");

    return {
      ok: true,
      // The server callback and the browser redirect carry the same result;
      // sharing an event id makes whichever lands second a no-op.
      eventId: `${transactionId || basketId}:${errCode}`,
      providerRef: basketId,
      status: paid ? "paid" : "failed",
      failureReason: paid ? undefined : (fields.get("err_msg") ?? `PayFast error ${errCode}`),
      amountPKR: Number.isFinite(amount) && amount > 0 ? amount : undefined,
      raw: Object.fromEntries(fields),
    };
  },

  async fetchStatus(providerRef) {
    const cfg = config();
    const token = await getAccessToken(cfg);

    // ── VERIFY (3/3): transaction status inquiry ────────────────────────────
    const res = await fetch(
      `${cfg.baseUrl}/Ecommerce/api/Transaction/transaction/basket_id/${encodeURIComponent(providerRef)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" } },
    );
    const raw = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(`PayFast status lookup failed (${res.status}).`);

    // Until this response shape is confirmed, reconciliation never settles a
    // PayFast payment on its own: marking an order paid from a misread field
    // ships goods for free. The signed callback remains the only way to paid.
    return { status: "pending", raw };
  },
};
