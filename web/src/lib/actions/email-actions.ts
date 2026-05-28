"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmail } from "@/lib/email-templates/order-confirmation";

export async function sendOrderConfirmationEmail(
  orderId: string,
  userEmail: string,
): Promise<void> {
  const admin = createSupabaseAdmin();

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, subtotal, shipping, discount_amount, total, payment_method, created_at")
    .eq("id", orderId)
    .single();

  if (orderErr || !order) {
    console.error(`sendOrderConfirmationEmail: order ${orderId} not found`, orderErr?.message);
    return;
  }

  const { data: rawItems, error: itemsErr } = await admin
    .from("order_items")
    .select("product_name, color, unit, quantity, unit_price, stitching, stitching_addon, line_total")
    .eq("order_id", orderId);

  if (itemsErr || !rawItems) {
    console.error(`sendOrderConfirmationEmail: items fetch failed for ${orderId}`, itemsErr?.message);
    return;
  }

  const html = buildOrderConfirmationEmail(
    order as Parameters<typeof buildOrderConfirmationEmail>[0],
    rawItems as Parameters<typeof buildOrderConfirmationEmail>[1],
  );

  await sendEmail({
    to: userEmail,
    subject: `Order Confirmed — ${orderId} | Berke Pak`,
    html,
  });
}
