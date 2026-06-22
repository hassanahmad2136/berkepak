"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmail } from "@/lib/email-templates/order-confirmation";
import { buildPaymentConfirmedEmail } from "@/lib/email-templates/payment-confirmed";

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

  const subject =
    order.payment_method === "bank_transfer"
      ? `Order Received — Upload Receipt to Confirm | Berke Pak`
      : `Order Confirmed — ${orderId} | Berke Pak`;

  await sendEmail({
    to: userEmail,
    subject,
    html,
  });
}

export async function sendPaymentConfirmedEmail(
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
    console.error(`sendPaymentConfirmedEmail: order ${orderId} not found`, orderErr?.message);
    return;
  }

  const { data: rawItems, error: itemsErr } = await admin
    .from("order_items")
    .select("product_name, color, unit, quantity, unit_price, stitching, stitching_addon, line_total")
    .eq("order_id", orderId);

  if (itemsErr || !rawItems) {
    console.error(`sendPaymentConfirmedEmail: items fetch failed for ${orderId}`, itemsErr?.message);
    return;
  }

  const html = buildPaymentConfirmedEmail(
    order as Parameters<typeof buildPaymentConfirmedEmail>[0],
    rawItems as Parameters<typeof buildPaymentConfirmedEmail>[1],
  );

  await sendEmail({
    to: userEmail,
    subject: `Payment Confirmed — ${orderId} | Berke Pak`,
    html,
  });
}
