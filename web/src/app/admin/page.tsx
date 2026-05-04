import Link from "next/link";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/components/SetupNotice";

export default async function AdminOverviewPage() {
  if (!isSupabaseConfigured()) return null;
  const admin = createSupabaseAdmin();

  const [{ count: pendingReceipts }, { count: awaitingUpload }, { count: openOrders }] =
    await Promise.all([
      admin.from("receipts").select("id", { count: "exact", head: true }).eq("status", "pending"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_method", "bank_transfer")
        .eq("payment_status", "awaiting_receipt"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["unconfirmed", "confirmed", "fulfilled"]),
    ]);

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Receipts pending review", value: pendingReceipts ?? 0, href: "/admin/receipts" },
          { label: "Orders awaiting receipt", value: awaitingUpload ?? 0, href: "/admin/orders" },
          { label: "Open orders", value: openOrders ?? 0, href: "/admin/orders" },
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
