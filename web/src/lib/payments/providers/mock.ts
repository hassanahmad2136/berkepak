import "server-only";
import crypto from "crypto";
import type {
  InitiateInput,
  InitiateResult,
  PaymentProvider,
  PaymentStatus,
  WebhookVerification,
} from "../types";

/**
 * Sandbox simulator.
 *
 * Stands in for a real gateway so the whole flow — initiate, customer approves,
 * signed webhook, order marked paid — is exercisable end to end before any
 * merchant account exists. It is deliberately *not* a stub that flips a
 * database row: it issues a reference, sends the customer to a hosted page, and
 * calls the real webhook endpoint with a real HMAC signature, so the code path
 * under test is the same one a live provider will drive.
 *
 * Never selectable in production — see registry.ts.
 */

const SECRET = process.env.MOCK_PAYMENTS_SECRET ?? "mock-sandbox-secret";

export function signMockPayload(rawBody: string): string {
  return crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex");
}

export const mockProvider: PaymentProvider = {
  name: "mock",
  displayName: "Pay online (sandbox)",
  supports: ["hosted_checkout", "raast_rtp", "raast_qr", "card"],

  async initiate(input: InitiateInput): Promise<InitiateResult> {
    const providerRef = `MOCK-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;
    const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

    return {
      providerRef,
      // Raast RTP is push-then-wait: the request is delivered and the customer
      // approves in their banking app, so the payment opens as pending.
      status: "pending",
      redirectUrl: `${origin}/pay/sandbox/${providerRef}?order=${encodeURIComponent(input.orderId)}`,
      qrPayload:
        input.method === "raast_qr"
          ? `P2M:${providerRef}:PKR:${input.amountPKR.toFixed(2)}`
          : undefined,
      raw: { simulated: true, method: input.method, amount: input.amountPKR },
    };
  },

  async verifyWebhook(rawBody, headers): Promise<WebhookVerification> {
    const provided = headers["x-mock-signature"] ?? headers["X-Mock-Signature"];
    if (!provided) return { ok: false, reason: "Missing signature header." };

    const expected = signMockPayload(rawBody);
    // Constant-time compare: a fast-exit compare leaks the signature byte by byte.
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false, reason: "Signature mismatch." };
    }

    let parsed: { eventId?: string; providerRef?: string; status?: string; reason?: string };
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return { ok: false, reason: "Body is not valid JSON." };
    }

    if (!parsed.eventId || !parsed.providerRef || !parsed.status) {
      return { ok: false, reason: "Missing eventId, providerRef or status." };
    }

    return {
      ok: true,
      eventId: parsed.eventId,
      providerRef: parsed.providerRef,
      status: parsed.status as PaymentStatus,
      failureReason: parsed.reason,
      raw: parsed,
    };
  },

  async fetchStatus(providerRef) {
    // The simulator has no ledger of its own; the payments table is the record.
    return { status: "pending", raw: { providerRef, note: "simulator has no remote state" } };
  },
};
