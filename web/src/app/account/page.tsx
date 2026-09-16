import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { queryOne } from "@/lib/db";

export default async function AccountOverviewPage() {
  const user = await requireUser("/account");

  // Every count is scoped to the signed-in user. These queries previously had no
  // user predicate at all and leaned entirely on RLS to filter them.
  const counts = await queryOne<{
    open_orders: string;
    awaiting_receipt: string;
    wishlist: string;
  }>(
    `select
       (select count(*) from orders
         where user_id = $1
           and status in ('unconfirmed','confirmed','fulfilled','shipped'))       as open_orders,
       (select count(*) from orders
         where user_id = $1
           and payment_method = 'bank_transfer'
           and payment_status in ('awaiting_receipt','awaiting_review'))          as awaiting_receipt,
       (select count(*) from wishlist where user_id = $1)                         as wishlist`,
    [user.id],
  );

  const stats = [
    { label: "Open Orders", value: Number(counts?.open_orders ?? 0) },
    { label: "Awaiting Receipt / Review", value: Number(counts?.awaiting_receipt ?? 0) },
    { label: "Wishlist", value: Number(counts?.wishlist ?? 0) },
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
        <ul className="mt-4 grid gap-3 max-w-md">
          <li>
            <Link href="/account/receipts" className="block border border-stone p-5 hover:border-ink">
              <p className="text-sm font-medium">Upload bank transfer receipt</p>
              <p className="mt-1 text-xs text-muted">
                Submit your transaction screenshot for manual verification.
              </p>
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
