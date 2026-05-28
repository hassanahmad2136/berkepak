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
  otpVerified: boolean;
  promoId?: string;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string }
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
  if (validInput.paymentMethod === "cod" && !validInput.otpVerified) {
    return { ok: false, error: "Mobile number must be verified for Cash on Delivery." };
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
  // Step B: Save to Supabase
  // -----------------------------------------------------------------------
  const orderId = newOrderId();

  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: validInput.paymentMethod,
    payment_status:
      validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal: originalSubtotal,
    shipping,
    discount_amount: discountAmount,
    promo_id: storedPromoId,
    total,
    shipping_address: validInput.address,
    otp_verified: validInput.otpVerified,
  });
  if (orderErr) return { ok: false, error: orderErr.message };

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(items.map((it) => ({
      order_id: orderId,
      product_id: it.product_id,
      product_name: it.product_name,
      product_slug: it.product_slug,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
      stitching: it.stitching,
      stitching_addon: it.stitching_addon,
      line_total: it.line_total,
      color: it.color,
    })));
  if (itemsErr) return { ok: false, error: itemsErr.message };

  // -----------------------------------------------------------------------
  // Step C: Decrement product_colors stock (non-fatal — order already saved)
  // -----------------------------------------------------------------------
  const adminClient = createSupabaseAdmin();
  for (const it of items) {
    const { data: stockOk, error: decErr } = await adminClient.rpc("decrement_product_stock", {
      p_product_id: it.product_id,
      p_color_name: it.color,
      p_quantity: it.quantity,
    });
    if (decErr) {
      console.error(`Stock decrement error for product ${it.product_id}:`, decErr.message);
    } else if (!stockOk) {
      console.warn(`Insufficient stock for product ${it.product_id} color ${it.color} — order saved, stock not decremented`);
    }
  }

  revalidatePath("/account/orders");

  // Send confirmation immediately for COD. Bank transfer waits for admin receipt approval.
  if (userData.user.email && validInput.paymentMethod !== "bank_transfer") {
    try {
      await sendOrderConfirmationEmail(orderId, userData.user.email);
    } catch (err) {
      console.error("Order confirmation email failed:", err);
    }
  }

  return { ok: true, orderId };
}
