import { createSupabaseServer } from "@/lib/supabase/server";
import { ReceiptUploadForm } from "./ReceiptUploadForm";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ReceiptsPage() {
  const supabase = await createSupabaseServer();
  const { data: receipts } = await supabase
    .from("receipts")
    .select("id, order_id, status, created_at, notes")
    .order("created_at", { ascending: false });
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("payment_method", "bank_transfer")
    .eq("payment_status", "awaiting_receipt")
    .order("created_at", { ascending: false });

  return (
    <div>
      <h2 className="display text-2xl">Bank transfer receipts</h2>
      <p className="mt-2 text-sm text-muted">
        Upload a screenshot of your transfer. Our team will verify it within 1
        business day and release your order to fulfillment.
      </p>

      <ReceiptUploadForm pendingOrderIds={pendingOrders?.map((o) => o.id) ?? []} />

      <section className="mt-12">
        <h3 className="eyebrow text-muted">Submitted receipts</h3>
        {!receipts || receipts.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No receipts uploaded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-stone border border-stone">
            {receipts.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="text-sm">{r.order_id}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(r.created_at).toLocaleString()}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.14em]">
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
