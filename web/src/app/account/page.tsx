import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AccountOverviewPage() {
  const supabase = await createSupabaseServer();

  const [{ count: openOrders }, { count: awaitingReceipt }, { count: wishlistCount }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["unconfirmed", "confirmed", "fulfilled", "shipped"]),
      supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("payment_method", "bank_transfer")
        .in("payment_status", ["awaiting_receipt", "awaiting_review"]),
      supabase.from("wishlist").select("product_id", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "Open Orders", value: openOrders ?? 0 },
    { label: "Awaiting Receipt / Review", value: awaitingReceipt ?? 0 },
    { label: "Wishlist", value: wishlistCount ?? 0 },
  ];

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="border border-stone p-5">
            <p className="eyebrow text-muted">{s.label}</p>
            <p className="display mt-2 text-3xl">{s.value}</p>
          </div>
        ))}
      </section>

      <section>
        <h2 className="display text-2xl">Quick actions</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          <li>
            <Link href="/account/receipts" className="block border border-stone p-5 hover:border-ink">
              <p className="text-sm font-medium">Upload bank transfer receipt</p>
              <p className="mt-1 text-xs text-muted">
                Submit your transaction screenshot for manual verification.
              </p>
            </Link>
          </li>
          <li>
            <Link href="/account/profile" className="block border border-stone p-5 hover:border-ink">
              <p className="text-sm font-medium">Add measurement profile</p>
              <p className="mt-1 text-xs text-muted">
                Save chest, shoulder, sleeve and length for bespoke stitching.
              </p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
