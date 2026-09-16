import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { formatPKR } from "@/lib/format";
import { PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/payment-labels";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/order-status";

const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default async function OrdersPage() {
  const user = await requireUser("/account/orders");
  const orders = await query<{
    id: string;
    status: string;
    payment_method: string;
    payment_status: string;
    total: string;
    courier: string | null;
    tracking_number: string | null;
    created_at: Date;
  }>(
    `select id, status, payment_method, payment_status, total, courier, tracking_number, created_at
       from orders
      where user_id = $1
      order by created_at desc`,
    [user.id],
  );

  if (!orders || orders.length === 0) {
    return (
      <div>
        <h2 className="display text-2xl">Your orders</h2>
        <p className="mt-2 text-sm text-muted">
          You haven't placed any orders yet.{" "}
          <Link href="/shop" className="link-underline text-ink">
            Start browsing
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="display text-2xl">Your orders</h2>
      <ul className="mt-6 divide-y divide-stone border border-stone">
        {orders.map((o) => (
          <li key={o.id} className="grid gap-2 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-sm font-medium">{o.id}</p>
              <p className="mt-1 text-xs text-muted">
                {new Date(o.created_at).toLocaleDateString()} ·{" "}
                {ORDER_STATUS_LABEL[o.status as OrderStatus] ?? o.status} ·{" "}
                {PAYMENT_METHOD_LABEL[o.payment_method] ?? o.payment_method} —{" "}
                {PAYMENT_STATUS_LABEL[o.payment_status] ?? o.payment_status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm">{formatPKR(Number(o.total))}</p>
              {o.tracking_number && (
                <p className="mt-1 text-xs text-muted">
                  {o.courier} <span className="font-mono">{o.tracking_number}</span>
                </p>
              )}
              {o.payment_method === "bank_transfer" &&
                o.payment_status === "awaiting_receipt" && (
                  <Link
                    href="/account/receipts"
                    className="link-underline mt-1 inline-block text-xs"
                  >
                    Send transfer details →
                  </Link>
                )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
