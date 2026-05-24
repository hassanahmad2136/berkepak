"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer, createSupabaseAdmin } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getProductByIdAsync } from "@/lib/products";
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
};

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

function newOrderId(): string {
  return "BPK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ---------------------------------------------------------------------------
// Main placeOrder
// ---------------------------------------------------------------------------

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rateLimit = await checkRateLimit("checkout_place", 5);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error ?? "Too many requests." };
  }

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Please sign in to place an order." };

  if (input.lines.length === 0) return { ok: false, error: "Cart is empty." };
  if (input.paymentMethod === "cod" && !input.otpVerified) {
    return { ok: false, error: "Mobile number must be verified for Cash on Delivery." };
  }

  // Recompute totals server-side so the client cannot tamper with prices.
  const items = await Promise.all(input.lines.map(async (line) => {
    const product = await getProductByIdAsync(line.productId);
    if (!product) throw new Error(`Unknown product ${line.productId}`);

    const unitPrice = product.pricePerSuit;
    const stitchingAddon =
      line.stitching === "bespoke"
        ? BESPOKE_STITCHING_ADDON_PKR
        : 0;
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
      color,
    };
  }));

  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const shipping = subtotal >= 10_000 ? 0 : 350;
  const total = subtotal + shipping;

  // -----------------------------------------------------------------------
  // Step B: Save to Supabase
  // -----------------------------------------------------------------------
  const orderId = newOrderId();

  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: input.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: input.paymentMethod,
    payment_status:
      input.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal,
    shipping,
    total,
    shipping_address: input.address,
    otp_verified: input.otpVerified,
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
    const { error: decErr } = await adminClient.rpc("decrement_product_stock", {
      p_product_id: it.product_id,
      p_color_name: it.color,
      p_quantity: it.quantity,
    });
    if (decErr) {
      console.error(`Stock decrement failed for product ${it.product_id}:`, decErr.message);
      // Non-fatal: order is saved, stock reconciliation can be done manually
    }
  }

  revalidatePath("/account/orders");
  return { ok: true, orderId };
}
