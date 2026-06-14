"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { PlaceOrderSchema } from "@/lib/validation";
import { getProductByIdAsync } from "@/lib/products";
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type Address,
  type CartLine,
  type PaymentMethod,
  type SaleUnit,
} from "@/lib/types";

export type PlaceOrderInput = {
  lines: CartLine[];
  address: Address;
  paymentMethod: PaymentMethod;
  promoId?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string; total: number }
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

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Please sign in to place an order." };

  if (validInput.lines.length === 0) return { ok: false, error: "Cart is empty." };

  // For COD: verify OTP was actually consumed server-side — never trust a client boolean.
  if (validInput.paymentMethod === "cod") {
    const adminOtp = createSupabaseAdmin();
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15-min window
    const { data: otpRow } = await adminOtp
      .from("otp_codes")
      .select("id")
      .eq("phone", validInput.address.phone)
      .not("consumed_at", "is", null)
      .gte("consumed_at", cutoff)
      .limit(1)
      .maybeSingle();
    if (!otpRow) {
      return { ok: false, error: "Mobile number must be verified for Cash on Delivery." };
    }
  }

  // Fetch active campaigns once — used for per-line discount computation.
  const campaigns = await getActiveCampaigns();

  // Recompute totals server-side so the client cannot tamper with prices.
  const items = await Promise.all(validInput.lines.map(async (line) => {
    const product = await getProductByIdAsync(line.productId);
    if (!product) throw new Error(`Unknown product ${line.productId}`);

    const campaign = getCampaignForProduct(product.id, product.category, campaigns);
    const campaignDisc = campaign
      ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)
      : null;
    const unitPrice = campaignDisc?.discountedPricePerSuit ?? product.pricePerSuit;
    const stitchingAddon =
      line.stitching === "bespoke"
        ? BESPOKE_STITCHING_ADDON_PKR
        : 0;
    const originalLineTotal = (product.pricePerSuit + stitchingAddon) * line.quantity;
    const lineTotal = (unitPrice + stitchingAddon) * line.quantity;

    const color = line.color || "White";

    return {
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      unit: line.unit as SaleUnit,
      quantity: line.quantity,
      unit_price: unitPrice,
      stitching: line.stitching,
      stitching_addon: stitchingAddon,
      line_total: lineTotal,
      original_line_total: originalLineTotal,
      color,
    };
  }));

  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const originalSubtotal = items.reduce((sum, it) => sum + it.original_line_total, 0);
  // Shipping threshold based on original (pre-discount) subtotal.
  const shipping = originalSubtotal >= 10_000 ? 0 : 350;

  // Campaign discount = difference between original and discounted line totals.
  const campaignDiscount = originalSubtotal - subtotal;

  // Re-validate coupon server-side against originalSubtotal (never trust client).
  let couponDiscount = 0;
  let validatedPromoId: string | null = null;
  if (validInput.promoId) {
    const adminForPromo = createSupabaseAdmin();
    const { data: promo } = await adminForPromo
      .from("promotions")
      .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
      .eq("id", validInput.promoId)
      .eq("type", "coupon")
      .eq("is_active", true)
      .maybeSingle();
    if (promo) {
      const now = new Date();
      const validDates =
        (!promo.starts_at || new Date(promo.starts_at) <= now) &&
        (!promo.ends_at || new Date(promo.ends_at) >= now);
      const validMin = originalSubtotal >= Number(promo.min_order_amount ?? 0);
      if (validDates && validMin) {
        couponDiscount =
          promo.discount_type === "pct"
            ? Math.floor(originalSubtotal * (Number(promo.discount_value) / 100))
            : Math.min(Number(promo.discount_value), originalSubtotal);
        validatedPromoId = promo.id;
      }
    }
  }

  // Larger discount wins — campaign and coupon do not stack.
  const discountAmount = Math.max(campaignDiscount, couponDiscount);
  // Store promo_id only when coupon wins; null signals automatic campaign discount.
  const storedPromoId = couponDiscount >= campaignDiscount ? validatedPromoId : null;

  const total = Math.max(0, originalSubtotal + shipping - discountAmount);

  // -----------------------------------------------------------------------
  // Step B+C: Atomically insert order + order_items + decrement stock.
  // The PostgreSQL function place_order_atomic runs all three steps in a
  // single transaction — any failure (including insufficient stock) rolls
  // back the entire operation so the DB cannot end up with a partial order.
  // -----------------------------------------------------------------------
  const orderId = newOrderId();

  const adminClient = createSupabaseAdmin();
  const { error: placeErr } = await adminClient.rpc("place_order_atomic", {
    p_order_id: orderId,
    p_user_id: userData.user.id,
    p_status: validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    p_payment_method: validInput.paymentMethod,
    p_payment_status: validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    p_subtotal: originalSubtotal,
    p_shipping: shipping,
    p_discount_amount: discountAmount,
    p_promo_id: storedPromoId,
    p_total: total,
    p_shipping_address: validInput.address,
    p_otp_verified: validInput.paymentMethod === "cod",
    p_items: items,  // Supabase serializes as JSONB
  });
  if (placeErr) return { ok: false, error: placeErr.message };

  revalidatePath("/account/orders");

  // Send confirmation immediately for COD. Bank transfer waits for admin receipt approval.
  if (userData.user.email && validInput.paymentMethod !== "bank_transfer") {
    try {
      await sendOrderConfirmationEmail(orderId, userData.user.email);
    } catch (err) {
      console.error("Order confirmation email failed:", err);
    }
  }

  return { ok: true, orderId, total };
}
