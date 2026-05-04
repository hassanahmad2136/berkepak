import { createSupabaseAdmin } from "@/lib/supabase/server";
import { formatPKR } from "@/lib/format";
import { isSupabaseConfigured } from "@/components/SetupNotice";

const PAYMENT_LABEL: Record<string, string> = {
  pending: "Pending",
  awaiting_receipt: "Awaiting receipt",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  paid: "Paid",
  refunded: "Refunded",
};

export default async function AdminOrdersPage() {
  if (!isSupabaseConfigured()) return null;
  const admin = createSupabaseAdmin();
  const { data: orders } = await admin
    .from("orders")
    .select(
      "id, status, payment_method, payment_status, total, shipping_address, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h2 className="display text-2xl">Recent orders</h2>

      {!orders || orders.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No orders yet.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone border border-stone">
          {orders.map((o) => {
            const addr = o.shipping_address as {
              fullName?: string;
              city?: string;
            } | null;
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
                  <p className="text-xs text-muted mt-1">
                    {o.payment_method === "cod" ? "COD" : "Bank Transfer"} ·{" "}
                    {PAYMENT_LABEL[o.payment_status] ?? o.payment_status}
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
