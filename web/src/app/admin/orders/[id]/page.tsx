import Link from "next/link";
import { notFound } from "next/navigation";
import { query, queryOne } from "@/lib/db";
import { formatPKR } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payment-labels";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";
import { signedUrl } from "@/lib/storage";
import { isDatabaseConfigured } from "@/components/SetupNotice";
import { OrderActions } from "./OrderActions";

export const dynamic = "force-dynamic";

/** Everything needed to decide what happens to one order, on one screen. */
export default async function AdminOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  if (!isDatabaseConfigured()) return null;
  const { id } = await props.params;

  const order = await queryOne<{
    id: string;
    status: string;
    payment_method: string;
    payment_status: string;
    subtotal: string;
    shipping: string;
    discount_amount: string;
    total: string;
    payment_surcharge: string;
    shipping_address: Record<string, string> | null;
    guest_email: string | null;
    courier: string | null;
    tracking_number: string | null;
    cancel_reason: string | null;
    created_at: Date;
    shipped_at: Date | null;
    delivered_at: Date | null;
    cancelled_at: Date | null;
    customer_email: string | null;
  }>(
    `select o.*, coalesce(u.email, o.guest_email) as customer_email
       from orders o left join users u on u.id = o.user_id
      where o.id = $1`,
    [id],
  );
  if (!order) notFound();

  const items = await query<{
    product_name: string;
    color: string;
    unit: string;
    quantity: string;
    unit_price: string;
    line_total: string;
  }>(
    `select product_name, color, unit, quantity, unit_price, line_total
       from order_items where order_id = $1`,
    [id],
  );

  const receipts = await query<{
    id: string;
    transaction_id: string | null;
    status: string;
    storage_path: string;
    created_at: Date;
  }>(
    `select id, transaction_id, status, storage_path, created_at
       from receipts where order_id = $1 order by created_at desc`,
    [id],
  );
  const receiptLinks = await Promise.all(
    receipts.map(async (r) => ({
      ...r,
      url: await signedUrl("receipts", r.storage_path).catch(() => null),
    })),
  );

  const payments = await query<{
    provider: string;
    method: string;
    provider_ref: string | null;
    amount: string;
    status: string;
    failure_reason: string | null;
    created_at: Date;
  }>(
    `select provider, method, provider_ref, amount, status, failure_reason, created_at
       from payments where order_id = $1 order by created_at desc`,
    [id],
  );

  const addr = order.shipping_address ?? {};
  const surcharge = Number(order.payment_surcharge);
  const timeline: Array<[string, Date | null]> = [
    ["Placed", order.created_at],
    ["Shipped", order.shipped_at],
    ["Delivered", order.delivered_at],
    ["Cancelled", order.cancelled_at],
  ];

  return (
    <div>
      <Link href="/admin/orders" className="link-underline text-xs text-muted">
        ← All orders
      </Link>

      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="display text-2xl">{order.id}</h2>
        <p className="text-sm text-muted">
          {ORDER_STATUS_LABEL[order.status as OrderStatus] ?? order.status} ·{" "}
          {PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method} —{" "}
          {PAYMENT_STATUS_LABEL[order.payment_status] ?? order.payment_status}
        </p>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr] items-start">
        <div className="space-y-6">
          <section className="border border-stone p-5">
            <p className="eyebrow text-muted">Items</p>
            <ul className="mt-3 divide-y divide-stone text-sm">
              {items.map((it, i) => (
                <li key={i} className="flex justify-between gap-4 py-2">
                  <span>
                    {it.product_name}
                    <span className="text-muted">
                      {" "}
                      · {it.color} × {Number(it.quantity)} {it.unit}
                    </span>
                  </span>
                  <span>{formatPKR(Number(it.line_total))}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1 border-t border-stone pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Subtotal</dt>
                <dd>{formatPKR(Number(order.subtotal))}</dd>
              </div>
              {Number(order.discount_amount) > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted">Discount</dt>
                  <dd>−{formatPKR(Number(order.discount_amount))}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted">Shipping</dt>
                <dd>{formatPKR(Number(order.shipping))}</dd>
              </div>
              <div className="flex justify-between font-medium">
                <dt>Charged</dt>
                <dd>{formatPKR(Number(order.total))}</dd>
              </div>
              {surcharge > 0 && (
                <div className="flex justify-between text-xs text-muted">
                  <dt>Gateway fee inside that</dt>
                  <dd>
                    {formatPKR(surcharge)} · net {formatPKR(Number(order.total) - surcharge)}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section className="border border-stone p-5 text-sm">
            <p className="eyebrow text-muted">Ship to</p>
            <p className="mt-2">{addr.fullName ?? "—"}</p>
            <p className="text-muted">
              {addr.line1}
              {addr.line2 ? `, ${addr.line2}` : ""}, {addr.city}, {addr.province}{" "}
              {addr.postalCode}
            </p>
            <p className="text-muted">{addr.phone}</p>
            <p className="text-muted mt-2">{order.customer_email ?? "—"}</p>
          </section>

          {receiptLinks.length > 0 && (
            <section className="border border-stone p-5 text-sm">
              <p className="eyebrow text-muted">Bank transfer details</p>
              <p className="text-xs text-muted mt-1">
                Match the TID and the amount against the statement before approving on the
                receipts page.
              </p>
              <ul className="mt-3 space-y-2">
                {receiptLinks.map((r) => (
                  <li key={r.id} className="flex flex-wrap justify-between gap-2">
                    <span className="font-mono">{r.transaction_id ?? "—"}</span>
                    <span className="text-muted">
                      {r.status} · {new Date(r.created_at).toLocaleString()}
                      {r.url && (
                        <>
                          {" · "}
                          <a
                            href={r.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="link-underline"
                          >
                            screenshot
                          </a>
                        </>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payments.length > 0 && (
            <section className="border border-stone p-5 text-sm">
              <p className="eyebrow text-muted">Payment attempts</p>
              <ul className="mt-3 space-y-2">
                {payments.map((p, i) => (
                  <li key={i} className="flex flex-wrap justify-between gap-2">
                    <span>
                      {p.provider} · <span className="font-mono text-xs">{p.provider_ref ?? "—"}</span>
                    </span>
                    <span className="text-muted">
                      {formatPKR(Number(p.amount))} · {p.status}
                      {p.failure_reason ? ` · ${p.failure_reason}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-6 lg:sticky lg:top-6">
          <section className="border border-stone p-5">
            <p className="eyebrow text-muted">Fulfilment</p>
            <div className="mt-4">
              <OrderActions
                orderId={order.id}
                status={order.status as OrderStatus}
                paymentMethod={order.payment_method}
                paymentStatus={order.payment_status}
              />
            </div>
          </section>

          <section className="border border-stone p-5 text-sm">
            <p className="eyebrow text-muted">History</p>
            <dl className="mt-3 space-y-1">
              {timeline
                .filter(([, at]) => at)
                .map(([label, at]) => (
                  <div key={label} className="flex justify-between gap-3">
                    <dt className="text-muted">{label}</dt>
                    <dd>{new Date(at!).toLocaleString()}</dd>
                  </div>
                ))}
            </dl>
            {order.tracking_number && (
              <p className="mt-3 border-t border-stone pt-3">
                {order.courier}{" "}
                <span className="font-mono">{order.tracking_number}</span>
              </p>
            )}
            {order.cancel_reason && (
              <p className="mt-3 border-t border-stone pt-3 text-muted">
                Cancelled: {order.cancel_reason}
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
