import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail, isCurrentUserAdmin } from "@/lib/admin";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";
import { AdminHeader } from "./AdminHeader";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/pricing", label: "Pricing" },
  { href: "/admin/stock", label: "Inventory" },
  { href: "/admin/promotions", label: "Promotions" },
  { href: "/admin/campaigns", label: "Campaigns" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Admin" />;

  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) redirect("/login?next=/admin");

    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
        <p className="eyebrow text-muted">Admin</p>
        <h1 className="display mt-3 text-3xl">Not authorized.</h1>
        <p className="mt-3 text-sm text-muted">
          Access is restricted to authorized store administrators. Please contact your systems manager or sign in with an administrator account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-12">
      <AdminHeader />

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-28 lg:self-start">
          <nav className="flex flex-row gap-1 overflow-x-auto lg:flex-col text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="px-3 py-2 link-underline whitespace-nowrap"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
