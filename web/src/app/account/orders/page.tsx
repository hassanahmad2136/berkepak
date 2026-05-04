import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  fulfilled: "Fulfilled",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pending",
  awaiting_receipt: "Awaiting receipt upload",
  awaiting_review: "Awaiting our review",
  approved: "Approved",
  paid: "Paid",
  refunded: "Refunded",
};

export default async function OrdersPage() {
  const supabase = await createSupabaseServer();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, status, payment_method, payment_status, total, created_at")
    .order("created_at", { ascending: false });

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
                {STATUS_LABEL[o.status] ?? o.status} ·{" "}
                {o.payment_method === "cod" ? "Cash on Delivery" : "Bank Transfer"} —{" "}
                {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm">{formatPKR(Number(o.total))}</p>
              {o.payment_method === "bank_transfer" &&
                o.payment_status === "awaiting_receipt" && (
                  <Link
                    href="/account/receipts"
                    className="link-underline mt-1 inline-block text-xs"
                  >
                    Upload receipt →
                  </Link>
                )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
