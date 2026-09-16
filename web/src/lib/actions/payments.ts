"use server";

import { headers } from "next/headers";
import { startPayment } from "@/lib/payments/service";
import { getProvider } from "@/lib/payments/registry";
import { queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rate-limit";
import type { PaymentMethodKind } from "@/lib/payments/types";

export type StartPaymentResult =
  | { ok: true; redirectUrl?: string; qrPayload?: string; providerRef: string }
  | { ok: false; error: string };

/**
 * Kicks off an online payment for an order the caller owns. The configured
 * gateway picks the method; checkout does not need to know which one is live.
 *
 * Ownership is checked here, not trusted from the client: an order id is
 * guessable enough that anyone could otherwise start a payment against a
 * stranger's order and read back its reference.
 */
export async function startOrderPayment(
  orderId: string,
  guestToken?: string,
): Promise<StartPaymentResult> {
  const rl = await checkRateLimit("payment_start", 10);
  if (!rl.success) return { ok: false, error: rl.error ?? "Too many requests." };

  const user = await getCurrentUser();

  type OwnedOrder = { id: string; guest_email: string | null; payment_method: string };
  const order = user
    ? await queryOne<OwnedOrder>(
        `select id, guest_email, payment_method from orders where id = $1 and user_id = $2`,
        [orderId, user.id],
      )
    : guestToken
      ? await queryOne<OwnedOrder>(
          `select id, guest_email, payment_method from orders
            where id = $1 and guest_token = $2 and user_id is null`,
          [orderId, guestToken],
        )
      : null;

  if (!order) return { ok: false, error: "Order not found." };
  // A bank-transfer order is priced without the gateway fee; charging it
  // through the gateway would leave the business paying that fee itself.
  if (order.payment_method !== "online") {
    return { ok: false, error: "This order was not placed for online payment." };
  }

  const email = user?.email ?? order.guest_email;
  if (!email) return { ok: false, error: "This order has no contact email." };

  const h = await headers();
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`;

  try {
    const payment = await startPayment({
      orderId,
      customer: { email, name: user?.fullName, phone: user?.phone },
      returnUrl: `${origin}/order/${encodeURIComponent(orderId)}${
        guestToken ? `?token=${encodeURIComponent(guestToken)}` : ""
      }`,
      origin,
    });

    return {
      ok: true,
      providerRef: payment.provider_ref!,
      redirectUrl: payment.redirect_url ?? undefined,
      qrPayload: payment.qr_payload ?? undefined,
    };
  } catch (err) {
    console.error("[payments] could not start payment:", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not start the payment.",
    };
  }
}

/** Which online methods the configured gateway can actually offer. */
export async function availablePaymentMethods(): Promise<PaymentMethodKind[]> {
  try {
    return [...getProvider().supports];
  } catch {
    return [];
  }
}
