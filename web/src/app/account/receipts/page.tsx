import { requireUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { ReceiptUploadForm } from "./ReceiptUploadForm";

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved",
  rejected: "Rejected",
};

export default async function ReceiptsPage() {
  const user = await requireUser("/account/receipts");

  const receipts = await query<{
    id: string;
    order_id: string | null;
    status: string;
    created_at: Date;
    note: string | null;
    transaction_id: string | null;
  }>(
    `select id, order_id, status, created_at, note, transaction_id
       from receipts
      where user_id = $1
      order by created_at desc`,
    [user.id],
  );

  const pendingOrders = await query<{ id: string }>(
    `select id from orders
      where user_id = $1
        and payment_method = 'bank_transfer'
        and payment_status = 'awaiting_receipt'
      order by created_at desc`,
    [user.id],
  );

  return (
    <div>
      <h2 className="display text-2xl">Bank transfer details</h2>
      <p className="mt-2 text-sm text-muted">
        Send the transaction ID from your bank app and a screenshot of the
        transfer. Our team matches it within 1 business day and releases your
        order to fulfillment.
      </p>

      <ReceiptUploadForm pendingOrderIds={pendingOrders.map((o) => o.id)} />

      <section className="mt-12">
        <h3 className="eyebrow text-muted">Submitted receipts</h3>
        {receipts.length === 0 ? (
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
                  {r.transaction_id && (
                    <p className="text-xs text-muted font-mono">TID {r.transaction_id}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(r.created_at).toLocaleString()}
                    {r.note ? ` · ${r.note}` : ""}
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
