import Link from "next/link";
import { queryOne } from "@/lib/db";
import { isDatabaseConfigured } from "@/components/SetupNotice";

export default async function AdminOverviewPage() {
  if (!isDatabaseConfigured()) return null;

  // Store-wide counts: admin views are deliberately not user-scoped.
  const counts = await queryOne<{
    pending_receipts: string;
    awaiting_upload: string;
    open_orders: string;
  }>(
    `select
       (select count(*) from receipts where status = 'pending')                as pending_receipts,
       (select count(*) from orders
         where payment_method = 'bank_transfer'
           and payment_status = 'awaiting_receipt')                            as awaiting_upload,
       (select count(*) from orders
         where status in ('unconfirmed','confirmed','fulfilled'))              as open_orders`,
  );
  const pendingReceipts = Number(counts?.pending_receipts ?? 0);
  const awaitingUpload = Number(counts?.awaiting_upload ?? 0);
  const openOrders = Number(counts?.open_orders ?? 0);

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Receipts pending review", value: pendingReceipts, href: "/admin/receipts" },
          { label: "Orders awaiting receipt", value: awaitingUpload, href: "/admin/orders" },
          { label: "Open orders", value: openOrders, href: "/admin/orders" },
        ].map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="block border border-stone p-5 hover:border-ink"
          >
            <p className="eyebrow text-muted">{s.label}</p>
            <p className="display mt-2 text-3xl">{s.value}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
