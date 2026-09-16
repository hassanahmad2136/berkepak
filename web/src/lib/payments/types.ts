/**
 * Provider-agnostic payment contract.
 *
 * Every gateway — PayFast, 1LINK 1GO, XPay, a card acquirer — reduces to the
 * same three questions: start a payment, tell me when it settled, and let me
 * ask if I missed the callback. Keeping that surface small is what makes
 * swapping providers a config change rather than a rewrite.
 */

export type PaymentMethodKind =
  /** Raast Request-to-Pay: the request lands in the customer's banking app. */
  | "raast_rtp"
  /** Raast QR: customer scans with any bank app. */
  | "raast_qr"
  /** Card rails (PayPak / Visa / Mastercard). */
  | "card"
  /** A gateway-hosted page that offers its own card, wallet and bank options. */
  | "hosted_checkout";

export type PaymentStatus =
  | "initiated"
  | "pending"
  | "paid"
  | "failed"
  | "expired"
  | "cancelled";

/** Statuses that will never change again. */
export const TERMINAL_STATUSES: PaymentStatus[] = ["paid", "failed", "expired", "cancelled"];

export interface InitiateInput {
  orderId: string;
  /** Whole rupees. Providers differ on minor units; each adapter converts. */
  amountPKR: number;
  method: PaymentMethodKind;
  customer: { email: string; name?: string | null; phone?: string | null };
  /** Where to send the customer back to once they are done. */
  returnUrl: string;
  /** Public origin of this site, for the gateway's callback and redirect URLs. */
  origin: string;
}

export interface InitiateResult {
  /** The provider's identifier for this attempt. Must be stable. */
  providerRef: string;
  status: PaymentStatus;
  /** Hosted-page providers return a URL to send the customer to. */
  redirectUrl?: string;
  /** QR providers return a payload to render. */
  qrPayload?: string;
  raw?: unknown;
}

export type WebhookVerification =
  | {
      ok: true;
      /** Provider's event id — the idempotency key for redelivery. */
      eventId: string;
      providerRef: string;
      status: PaymentStatus;
      failureReason?: string;
      /** What the gateway says was paid, when its callback reports it. */
      amountPKR?: number;
      raw: unknown;
    }
  | { ok: false; reason: string };

export interface PaymentProvider {
  readonly name: string;
  /** Shown to customers at checkout. */
  readonly displayName: string;
  readonly supports: PaymentMethodKind[];

  initiate(input: InitiateInput): Promise<InitiateResult>;

  /**
   * Verifies authenticity from the RAW payload — never from a parsed object,
   * since signatures are computed over exact bytes. For a provider that calls
   * back with a GET, the raw payload is the query string.
   */
  verifyWebhook(rawBody: string, headers: Record<string, string>): Promise<WebhookVerification>;

  /** Poll, for when a webhook never arrives. Reconciliation depends on it. */
  fetchStatus(providerRef: string): Promise<{ status: PaymentStatus; raw?: unknown }>;
}

export class PaymentConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentConfigError";
  }
}
