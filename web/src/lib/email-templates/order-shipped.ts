type OrderItem = {
  product_name: string;
  color: string;
  unit: string;
  quantity: number;
  line_total: number;
};

type OrderData = {
  id: string;
  total: number;
  courier: string | null;
  tracking_number: string | null;
};

function pkr(amount: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildOrderShippedEmail(order: OrderData, items: OrderItem[]): string {
  const itemRows = items
    .map(
      (it) => `
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a;">${it.product_name}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.color}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #6b6b63; text-align: center;">${it.quantity} ${it.unit}${it.quantity > 1 ? "s" : ""}</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #e5e5e0; font-size: 13px; color: #1a1a1a; text-align: right;">${pkr(it.line_total)}</td>
      </tr>`,
    )
    .join("");

  // Quote the tracking number rather than linking: courier tracking URLs
  // change, and a dead link is worse than a number they can paste.
  const trackingBlock =
    order.courier && order.tracking_number
      ? `
      <div style="background:#faf9f7;border:1px solid #e7e5e4;border-radius:12px;padding:24px;margin:0 0 32px;">
        <p style="margin:0 0 12px;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9b9b8a;font-weight:600;">Tracking</p>
        <p style="margin:0;font-size:15px;color:#1a1a1a;">${order.courier}</p>
        <p style="margin:6px 0 0;font-size:20px;color:#1a1a1a;font-weight:600;letter-spacing:0.04em;">${order.tracking_number}</p>
        <p style="margin:12px 0 0;font-size:12px;color:#6b6b63;">Track it on the courier's website with this number. It can take a few hours to appear.</p>
      </div>`
      : "";

  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#ffffff;padding:40px 0;">
    <div style="max-width:560px;margin:0 auto;padding:0 20px;">
      <p style="margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;color:#9b9b8a;">Berke Pak Fabrics</p>
      <h1 style="margin:0 0 8px;font-size:26px;color:#1a1a1a;font-weight:600;">Your order is on its way</h1>
      <p style="margin:0 0 32px;font-size:14px;color:#6b6b63;">Order ${order.id}</p>

      ${trackingBlock}

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 24px;">
        ${itemRows}
        <tr>
          <td colspan="3" style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#1a1a1a;">Total</td>
          <td style="padding:12px 0 0;font-size:15px;font-weight:bold;color:#1a1a1a;text-align:right;">${pkr(order.total)}</td>
        </tr>
      </table>

      <p style="margin:0 0 4px;font-size:13px;color:#6b6b63;">Questions? Email us at info@berkepakfabrics.com</p>
      <p style="margin:0;font-size:12px;color:#a8a29e;">Berke Pak Fabrics — Lahore, Pakistan</p>
    </div>
  </div>`;
}
