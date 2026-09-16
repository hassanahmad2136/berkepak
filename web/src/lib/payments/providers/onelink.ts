import "server-only";
import crypto from "crypto";
import {
  PaymentConfigError,
  type InitiateInput,
  type InitiateResult,
  type PaymentProvider,
  type PaymentStatus,
  type WebhookVerification,
} from "../types";

/**
 * 1LINK 1GO (Raast P2M) adapter.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ INCOMPLETE BY DESIGN — the wire format is unverified.                    │
 * │                                                                          │
 * │ 1LINK publishes its API specifications behind a login on the sandbox     │
 * │ portal, so the exact endpoint paths, field names and signature scheme    │
 * │ below are placeholders, NOT confirmed contract. Guessing them and        │
 * │ presenting the result as finished would be worse than leaving it plain.  │
 * │                                                                          │
 * │ To finish: log in to sandbox.1link.net.pk, open the P2M_RTP and P2M_QR   │
 * │ specs, and correct the three marked blocks. Nothing outside this file    │
 * │ needs to change — the rest of the app talks to PaymentProvider.          │
 * └─────────────────────────────────────────────────────────────────────────┘
 */

interface OneLinkConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  merchantId: string;
  webhookSecret: string;
}

function config(): OneLinkConfig {
  const baseUrl = process.env.ONELINK_BASE_URL;
  const clientId = process.env.ONELINK_CLIENT_ID;
  const clientSecret = process.env.ONELINK_CLIENT_SECRET;
  const merchantId = process.env.ONELINK_MERCHANT_ID;
  const webhookSecret = process.env.ONELINK_WEBHOOK_SECRET;

  if (!baseUrl || !clientId || !clientSecret || !merchantId || !webhookSecret) {
    throw new PaymentConfigError(
      "1LINK is not configured. Set ONELINK_BASE_URL, ONELINK_CLIENT_ID, " +
        "ONELINK_CLIENT_SECRET, ONELINK_MERCHANT_ID and ONELINK_WEBHOOK_SECRET.",
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ""), clientId, clientSecret, merchantId, webhookSecret };
}

/** Maps a provider status string onto ours. Extend once the real values are known. */
function mapStatus(raw: string): PaymentStatus {
  switch (raw?.toUpperCase()) {
    case "PAID":
    case "SUCCESS":
    case "COMPLETED":
      return "paid";
    case "PENDING":
    case "IN_PROGRESS":
    case "AWAITING_APPROVAL":
      return "pending";
    case "EXPIRED":
    case "TIMEOUT":
      return "expired";
    case "CANCELLED":
    case "REJECTED":
      return "cancelled";
    default:
      return "failed";
  }
}

async function authHeaders(cfg: OneLinkConfig): Promise<Record<string, string>> {
  // ── VERIFY (1/3): auth scheme ───────────────────────────────────────────
  // Assumed HTTP Basic over TLS. 1LINK may instead issue OAuth2 client-
  // credentials tokens, in which case fetch and cache a bearer token here.
  const basic = Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export const oneLinkProvider: PaymentProvider = {
  name: "onelink",
  displayName: "Raast (1LINK)",
  supports: ["raast_rtp", "raast_qr"],

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const cfg = config();

    // ── VERIFY (2/3): endpoint + request shape ────────────────────────────
    const endpoint =
      input.method === "raast_qr"
        ? `${cfg.baseUrl}/1go/p2m/qr`
        : `${cfg.baseUrl}/1go/p2m/rtp`;

    const body = {
      merchantId: cfg.merchantId,
      merchantOrderId: input.orderId,
      // Raast amounts are commonly minor units; confirm before going live.
      amount: Math.round(input.amountPKR * 100),
      currency: "PKR",
      customerEmail: input.customer.email,
      customerMobile: input.customer.phone ?? undefined,
      callbackUrl: input.returnUrl,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: await authHeaders(cfg),
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        `1LINK initiate failed (${res.status}): ${typeof raw === "object" ? JSON.stringify(raw) : raw}`,
      );
    }

    const data = raw as Record<string, string>;
    const providerRef = data.transactionId ?? data.paymentReference ?? data.rrn;
    if (!providerRef) {
      throw new Error("1LINK initiate returned no transaction reference.");
    }

    return {
      providerRef,
      status: mapStatus(data.status ?? "PENDING"),
      redirectUrl: data.redirectUrl,
      qrPayload: data.qrString ?? data.qrPayload,
      raw,
    };
  },

  async verifyWebhook(rawBody, headers): Promise<WebhookVerification> {
    const cfg = config();

    // ── VERIFY (3/3): signature scheme ────────────────────────────────────
    // Assumed HMAC-SHA256 over the raw body, hex-encoded, in x-1link-signature.
    const provided = headers["x-1link-signature"] ?? headers["X-1Link-Signature"];
    if (!provided) return { ok: false, reason: "Missing 1LINK signature header." };

    const expected = crypto
      .createHmac("sha256", cfg.webhookSecret)
      .update(rawBody)
      .digest("hex");

    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "Signature mismatch." };
    }

    let parsed: Record<string, string>;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "Body is not valid JSON." };
    }

    const providerRef = parsed.transactionId ?? parsed.paymentReference ?? parsed.rrn;
    const eventId = parsed.eventId ?? parsed.messageId ?? providerRef;
    if (!providerRef || !eventId) {
      return { ok: false, reason: "Missing transaction or event identifier." };
    }

    return {
      ok: true,
      eventId,
      providerRef,
      status: mapStatus(parsed.status),
      failureReason: parsed.responseMessage ?? parsed.reason,
      raw: parsed,
    };
  },

  async fetchStatus(providerRef) {
    const cfg = config();
    const res = await fetch(
      `${cfg.baseUrl}/1go/p2m/status/${encodeURIComponent(providerRef)}`,
      { headers: await authHeaders(cfg) },
    );
    const raw = (await res.json().catch(() => ({}))) as Record<string, string>;
    if (!res.ok) throw new Error(`1LINK status lookup failed (${res.status}).`);
    return { status: mapStatus(raw.status), raw };
  },
};
