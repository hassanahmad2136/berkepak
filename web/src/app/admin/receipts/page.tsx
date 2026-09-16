import { query, queryOne } from "@/lib/db";
import { signedUrl } from "@/lib/storage";
import { ReceiptRow } from "./ReceiptRow";
import { formatPKR } from "@/lib/format";
import { isDatabaseConfigured } from "@/components/SetupNotice";

export default async function AdminReceiptsPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  if (!isDatabaseConfigured()) return null;
  const { status = "pending" } = await props.searchParams;
  const receipts = await query<{
    id: string;
    order_id: string | null;
    user_id: string;
    status: string;
    storage_path: string;
    transaction_id: string | null;
    note: string | null;
    created_at: Date;
    reviewed_at: Date | null;
  }>(
    `select id, order_id, user_id, status, storage_path, transaction_id, note, created_at, reviewed_at
       from receipts
      where status = $1
      order by created_at desc`,
    [status],
  );

  // Fan out for each receipt's order summary and a short-lived download URL.
  const enriched = await Promise.all(
    receipts.map(async (r) => {
      const [order, url] = await Promise.all([
        r.order_id
          ? queryOne(
              `select id, total, payment_status, status, shipping_address
                 from orders where id = $1`,
              [r.order_id],
            )
          : Promise.resolve(null),
        signedUrl("receipts", r.storage_path).catch(() => null),
      ]);
      return {
        ...r,
        order_id: r.order_id ?? "",
        created_at: r.created_at.toISOString(),
        notes: r.note,
        order,
        signedUrl: url,
      };
    }),
  );

  const tabs = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
  ];

  return (
    <div>
      <nav className="flex gap-2">
        {tabs.map((t) => {
          const active = status === t.value;
          return (
            <a
              key={t.value}
              href={`/admin/receipts?status=${t.value}`}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] border ${
                active ? "bg-ink text-paper border-ink" : "border-stone hover:border-ink"
              }`}
            >
              {t.label}
            </a>
          );
        })}
      </nav>

      {enriched.length === 0 ? (
        <p className="mt-10 text-sm text-muted">No receipts in this state.</p>
      ) : (
        <ul className="mt-8 space-y-3">
          {enriched.map((r) => (
            <ReceiptRow
              key={r.id}
              id={r.id}
              orderId={r.order_id}
              transactionId={r.transaction_id}
              status={r.status}
              notes={r.notes}
              signedUrl={r.signedUrl}
              createdAt={r.created_at}
              orderTotal={r.order ? formatPKR(Number(r.order.total)) : "—"}
              shippingName={
                (r.order?.shipping_address as { fullName?: string } | null)
                  ?.fullName ?? "—"
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
