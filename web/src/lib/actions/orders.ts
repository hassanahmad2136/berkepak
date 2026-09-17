"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { query, queryOne } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { PlaceOrderSchema } from "@/lib/validation";
import { quoteOrder } from "@/lib/order-pricing";
import { basisFor } from "@/lib/pricing";
import { isOnlinePaymentEnabled } from "@/lib/payments/registry";
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
import type { Address, CartLine, PaymentMethod } from "@/lib/types";

export type PlaceOrderInput = {
  lines: CartLine[];
  address: Address;
  paymentMethod: PaymentMethod;
  promoId?: string;
  /** Guest checkout only — ignored when a session is present. */
  guestEmail?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number; guestToken?: string }
  | { ok: false; error: string };

function newOrderId(): string {
  return "BPK-" + randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Main placeOrder
// ---------------------------------------------------------------------------

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rateLimit = await checkRateLimit("checkout_place", 5);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error ?? "Too many requests." };
  }

  const parsed = PlaceOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const validInput = parsed.data;

  // Hidden at checkout is not the same as refused: a stale tab or a crafted
  // request can still send "online", and would leave an order waiting on a
  // payment that cannot be started.
  if (validInput.paymentMethod === "online" && !isOnlinePaymentEnabled()) {
    return {
      ok: false,
      error: "Online payment is not available right now. Choose bank transfer or cash on delivery.",
    };
  }

  // Guest checkout is allowed. A signed-in customer's account email always wins
  // over anything the client sends, so a guest email cannot be used to
  // impersonate an account.
  const user = await getCurrentUser();
  const contactEmail = user?.email ?? validInput.guestEmail;
  if (!contactEmail) {
    return { ok: false, error: "An email address is required to place an order." };
  }

  if (validInput.lines.length === 0) return { ok: false, error: "Cart is empty." };

  // For COD: verify OTP was actually consumed server-side — never trust a client boolean.
  if (validInput.paymentMethod === "cod") {
    // The OTP is delivered to the contact email (the account's, or the address a
    // guest supplied). WhatsApp delivery is not live yet.
    const otpRow = await queryOne(
      `select id from otp_codes
        where destination = $1
          and consumed_at is not null
          and consumed_at >= now() - interval '15 minutes'
        limit 1`,
      [contactEmail],
    );
    if (!otpRow) {
      return { ok: false, error: "Email address must be verified for Cash on Delivery." };
    }
  }

  // Recompute totals server-side so the client cannot tamper with prices. The
  // payment method picks the price book: bank transfer is charged the stored
  // catalog price, every other method the listed price with the gateway fee
  // folded in. Campaigns, coupons and shipping are all applied in quoteOrder.
  let quote;
  try {
    quote = await quoteOrder(validInput.lines, validInput.promoId);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not price the order." };
  }
  const charged = basisFor(validInput.paymentMethod) === "net" ? quote.net : quote.listed;
  const paymentSurcharge = charged.basis === "listed" ? quote.gatewayFee : 0;

  // -----------------------------------------------------------------------
  // Atomically insert order + order_items + decrement stock.
  // The PostgreSQL function place_order_atomic runs all three steps in a
  // single transaction — any failure (including insufficient stock) rolls
  // back the entire operation so the DB cannot end up with a partial order.
  // -----------------------------------------------------------------------
  const orderId = newOrderId();
  // Guests get an unguessable token so they can come back to the order to
  // upload a bank-transfer receipt without an account.
  const guestToken = user ? null : randomUUID().replace(/-/g, "");

  try {
    await query(
      `select place_order_atomic($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13::jsonb,$14)`,
      [
        orderId,
        user?.id ?? null,
        validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
        validInput.paymentMethod,
        validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
        charged.subtotal,
        charged.shipping,
        charged.discountAmount,
        charged.promoId,
        charged.total,
        JSON.stringify(validInput.address),
        validInput.paymentMethod === "cod",
        JSON.stringify(charged.items),
        paymentSurcharge,
      ],
    );
  } catch (err) {
    // place_order_atomic raises on insufficient stock and rolls the whole
    // transaction back, so there is nothing to clean up here.
    const message = err instanceof Error ? err.message : "Could not place the order.";
    return { ok: false, error: message };
  }

  // Attach guest contact details to the order now that it exists.
  if (!user) {
    try {
      await query(`update orders set guest_email = $1, guest_token = $2 where id = $3`, [
        contactEmail,
        guestToken,
        orderId,
      ]);
    } catch (err) {
      console.error("[orders] attaching guest details failed:", err);
    }
  }

  // Save the shipping address so /account/addresses is populated and the next
  // checkout prefills. The page has always claimed this happens; it never did.
  if (user) {
    try {
      const a = validInput.address;
      await query(
        `insert into addresses
           (user_id, full_name, phone, line1, line2, city, province, postal_code, country, is_default)
         select $1,$2,$3,$4,$5,$6,$7,$8,$9,
                not exists (select 1 from addresses where user_id = $1)
          where not exists (
            select 1 from addresses
             where user_id = $1 and line1 = $4 and city = $6 and postal_code = $8
          )`,
        [
          user.id,
          a.fullName,
          a.phone,
          a.line1,
          a.line2 ?? null,
          a.city,
          a.province,
          a.postalCode,
          a.country ?? "Pakistan",
        ],
      );
    } catch (err) {
      // Never fail a placed order over an address bookkeeping write.
      console.error("[orders] saving shipping address failed:", err);
    }
  }

  revalidatePath("/account/addresses");
  revalidatePath("/account/orders");

  // COD: confirmed immediately. Bank transfer: send payment instructions email.
  try {
    await sendOrderConfirmationEmail(orderId, contactEmail, guestToken ?? undefined);
  } catch (err) {
    console.error("Order confirmation email failed:", err);
  }

  return { ok: true, orderId, total: charged.total, guestToken: guestToken ?? undefined };
}
