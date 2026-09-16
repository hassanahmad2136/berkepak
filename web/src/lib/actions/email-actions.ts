"use server";

import { query, queryOne } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { buildOrderConfirmationEmail } from "@/lib/email-templates/order-confirmation";
import { buildPaymentConfirmedEmail } from "@/lib/email-templates/payment-confirmed";
import { buildOrderShippedEmail } from "@/lib/email-templates/order-shipped";

const ORDER_COLUMNS = `id, subtotal, shipping, discount_amount, total, payment_method,
                       status, courier, tracking_number, created_at`;
const ITEM_COLUMNS = `product_name, color, unit, quantity, unit_price, stitching, stitching_addon, line_total`;

async function loadOrder(orderId: string, label: string) {
  const order = await queryOne(`select ${ORDER_COLUMNS} from orders where id = $1`, [orderId]);
  if (!order) {
    console.error(`${label}: order ${orderId} not found`);
    return null;
  }
  const items = await query(`select ${ITEM_COLUMNS} from order_items where order_id = $1`, [
    orderId,
  ]);
  return { order, items };
}

export async function sendOrderConfirmationEmail(
  orderId: string,
  userEmail: string,
  guestToken?: string,
): Promise<void> {
  const data = await loadOrder(orderId, "sendOrderConfirmationEmail");
  if (!data) return;

  let html = buildOrderConfirmationEmail(
    data.order as Parameters<typeof buildOrderConfirmationEmail>[0],
    data.items as Parameters<typeof buildOrderConfirmationEmail>[1],
  );

  // A guest has no account to look the order up from, so the token link is
  // their only route back — particularly to upload a bank-transfer receipt.
  if (guestToken) {
    const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
    const href = `${origin}/order/${encodeURIComponent(orderId)}?token=${encodeURIComponent(guestToken)}`;
    html += `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;max-width:560px;margin:0 auto 40px;padding:0 20px;">
        <div style="background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:28px;text-align:center;">
          <p style="font-size:15px;color:#44403c;margin:0 0 20px;">
            You checked out as a guest. Use this link to view your order${
              (data.order as { payment_method: string }).payment_method === "bank_transfer"
                ? " and send your transfer details"
                : ""
            }.
          </p>
          <a href="${href}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">View your order</a>
          <p style="font-size:12px;color:#a8a29e;margin:20px 0 0;word-break:break-all;">${href}</p>
        </div>
      </div>`;
  }

  // Only a paid order is a confirmed order. Bank transfer and online payments
  // are both unpaid at this point, so calling them "confirmed" would tell the
  // customer their order is secured when it is not.
  const method = (data.order as { payment_method: string }).payment_method;
  const subject =
    method === "bank_transfer"
      ? `Order Received — Send Transfer Details to Confirm | Berke Pak`
      : method === "online"
        ? `Order Received — Complete Payment | Berke Pak`
        : `Order Confirmed — ${orderId} | Berke Pak`;

  await sendEmail({ to: userEmail, subject, html });
}

export async function sendPaymentConfirmedEmail(
  orderId: string,
  userEmail: string,
): Promise<void> {
  const data = await loadOrder(orderId, "sendPaymentConfirmedEmail");
  if (!data) return;

  const html = buildPaymentConfirmedEmail(
    data.order as Parameters<typeof buildPaymentConfirmedEmail>[0],
    data.items as Parameters<typeof buildPaymentConfirmedEmail>[1],
  );

  await sendEmail({
    to: userEmail,
    subject: `Payment Confirmed — ${orderId} | Berke Pak`,
    html,
  });
}

export async function sendOrderShippedEmail(
  orderId: string,
  userEmail: string,
): Promise<void> {
  const data = await loadOrder(orderId, "sendOrderShippedEmail");
  if (!data) return;

  const html = buildOrderShippedEmail(
    data.order as Parameters<typeof buildOrderShippedEmail>[0],
    data.items as Parameters<typeof buildOrderShippedEmail>[1],
  );

  await sendEmail({
    to: userEmail,
    subject: `Your order has shipped \u2014 ${orderId} | Berke Pak`,
    html,
  });
}
