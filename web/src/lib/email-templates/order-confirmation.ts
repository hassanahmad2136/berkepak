type OrderItem = {
  product_name: string;
  color: string;
  unit: string;
  quantity: number;
  unit_price: number;
  stitching: string;
  stitching_addon: number;
  line_total: number;
};

type OrderData = {
  id: string;
  subtotal: number;
  shipping: number;
  discount_amount: number;
  total: number;
  payment_method: "cod" | "bank_transfer";
  created_at: string;
};

function pkr(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderConfirmationEmail(order: OrderData, items: OrderItem[]): string {
  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a;">${it.product_name}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.color}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.quantity} ${it.unit}${it.quantity > 1 ? "s" : ""}${it.stitching === "bespoke" ? " + Bespoke" : ""}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(it.line_total)}</td>
      </tr>`,
    )
    .join("");

  const discountRow =
    order.discount_amount > 0
      ? `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Promo Discount</td>
          <td style="padding: 8px 0; font-size: 13px; color: #16a34a; text-align: right;">−${pkr(order.discount_amount)}</td>
        </tr>`
      : "";

  const shippingRow =
    order.shipping === 0
      ? `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Shipping</td>
          <td style="padding: 8px 0; font-size: 13px; color: #16a34a; text-align: right;">Free</td>
        </tr>`
      : `<tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Shipping</td>
          <td style="padding: 8px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(order.shipping)}</td>
        </tr>`;

  const bankSection =
    order.payment_method === "bank_transfer"
      ? `
      <div style="margin-top: 32px; padding: 24px; border: 1px solid #e5e5e0; border-radius: 8px; background: #f9f9f7;">
        <p style="margin: 0 0 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; font-weight: 600;">Bank Transfer Details</p>
        <table style="width: 100%; font-size: 13px; border-collapse: collapse;">
          <tr><td style="padding: 4px 0; color: #6b6b63; width: 140px;">Bank</td><td style="padding: 4px 0; color: #1a1a1a;">Meezan Bank</td></tr>
          <tr><td style="padding: 4px 0; color: #6b6b63;">Account Title</td><td style="padding: 4px 0; color: #1a1a1a;">BZ Enterprises</td></tr>
          <tr><td style="padding: 4px 0; color: #6b6b63;">Account Number</td><td style="padding: 4px 0; color: #1a1a1a; font-family: monospace;">02140102913486</td></tr>
        </table>
        <p style="margin: 16px 0 0; font-size: 12px; color: #6b6b63; line-height: 1.6;">
          Please transfer <strong style="color: #1a1a1a;">${pkr(order.total)}</strong> using the details above, then upload your receipt screenshot from your account dashboard or via WhatsApp.
        </p>
      </div>`
      : `<p style="margin-top: 24px; font-size: 13px; color: #6b6b63; line-height: 1.6;">
          You'll receive an SMS with tracking details once your order ships. No payment needed — our rider will collect on delivery.
        </p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Order Confirmed — ${order.id}</title>
</head>
<body style="margin: 0; padding: 0; background: #f9f9f7; font-family: Georgia, 'Times New Roman', serif; color: #1a1a1a;">
  <div style="max-width: 600px; margin: 40px auto; background: #ffffff; border: 1px solid #e5e5e0; border-radius: 8px; overflow: hidden;">

    <!-- Header -->
    <div style="background: #1a1a1a; padding: 28px 40px;">
      <p style="margin: 0; font-family: sans-serif; font-size: 11px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: #9b9b8a;">Berke Pak Fabrics</p>
    </div>

    <!-- Body -->
    <div style="padding: 40px;">
      <p style="margin: 0 0 4px; font-family: sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; font-weight: 600;">Order Confirmed</p>
      <h1 style="margin: 4px 0 0; font-size: 28px; font-weight: normal; color: #1a1a1a;">${order.id}</h1>
      <p style="margin: 8px 0 0; font-size: 13px; color: #6b6b63;">${new Date(order.created_at).toLocaleDateString("en-PK", { year: "numeric", month: "long", day: "numeric" })}</p>

      <!-- Items -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 32px;">
        <thead>
          <tr style="border-bottom: 1px solid #1a1a1a;">
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: left; font-weight: 600;">Product</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: center; font-weight: 600;">Colour</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: center; font-weight: 600;">Qty</th>
            <th style="padding-bottom: 8px; font-family: sans-serif; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #9b9b8a; text-align: right; font-weight: 600;">Price</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <!-- Totals -->
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr>
          <td colspan="3" style="padding: 8px 0; font-size: 13px; color: #6b6b63;">Subtotal</td>
          <td style="padding: 8px 0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(order.subtotal)}</td>
        </tr>
        ${shippingRow}
        ${discountRow}
        <tr style="border-top: 1px solid #1a1a1a;">
          <td colspan="3" style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #1a1a1a;">Total</td>
          <td style="padding: 12px 0 0; font-size: 15px; font-weight: bold; color: #1a1a1a; text-align: right;">${pkr(order.total)}</td>
        </tr>
      </table>

      <!-- Payment method -->
      <p style="margin: 24px 0 0; font-size: 13px; color: #6b6b63;">
        Payment: <strong style="color: #1a1a1a;">${order.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer (Raast / IBAN)"}</strong>
      </p>

      ${bankSection}
    </div>

    <!-- Footer -->
    <div style="padding: 24px 40px; background: #f9f9f7; border-top: 1px solid #e5e5e0;">
      <p style="margin: 0; font-family: sans-serif; font-size: 11px; color: #9b9b8a; line-height: 1.6; text-align: center;">
        Questions? Email us at <a href="mailto:info@berkepakfabrics.com" style="color: #1a1a1a;">info@berkepakfabrics.com</a><br>
        Berke Pak Fabrics — Lahore, Pakistan
      </p>
    </div>

  </div>
</body>
</html>`;
}
