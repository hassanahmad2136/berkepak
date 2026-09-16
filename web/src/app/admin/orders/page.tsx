import { query } from "@/lib/db";
import { formatPKR } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payment-labels";
import { isDatabaseConfigured } from "@/components/SetupNotice";

export default async function AdminOrdersPage() {
  if (!isDatabaseConfigured()) return null;
  const orders = await query<{
    id: string;
    status: string;
    payment_method: string;
    payment_status: string;
    total: string;
    payment_surcharge: string;
    shipping_address: Record<string, unknown> | null;
    created_at: Date;
  }>(
    `select id, status, payment_method, payment_status, total, payment_surcharge,
            shipping_address, created_at
       from orders
      order by created_at desc
      limit 100`,
  );

  return (
    <div>
      <h2 className="display text-2xl">Recent orders</h2>

      {orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone border border-stone">
          {orders.map((o) => {
            const addr = o.shipping_address as {
              fullName?: string;
              city?: string;
            } | null;
            const surcharge = Number(o.payment_surcharge);
            return (
              <li
                key={o.id}
                className="grid gap-2 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-center text-sm"
              >
                <div>
                  <p className="font-medium">{o.id}</p>
                  <p className="text-xs text-muted mt-1">
                    {new Date(o.created_at).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p>{addr?.fullName ?? "—"}</p>
                  <p className="text-xs text-muted">{addr?.city ?? ""}</p>
                </div>
                <div className="text-right">
                  <p>{formatPKR(Number(o.total))}</p>
                  {/* The customer paid the listed price; the fee inside it goes to the gateway. */}
                  {surcharge > 0 && (
                    <p className="text-xs text-muted mt-1">
                      Net {formatPKR(Number(o.total) - surcharge)} · fee {formatPKR(surcharge)}
                    </p>
                  )}
                  <p className="text-xs text-muted mt-1">
                    {PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method} ·{" "}
                    {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
