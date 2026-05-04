import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/receipts", label: "Receipts" },
  { href: "/admin/orders", label: "Orders" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Admin" />;

  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/login?next=/admin");
  if (!isAdminEmail(data.user.email)) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
        <p className="eyebrow text-muted">Admin</p>
        <h1 className="display mt-3 text-3xl">Not authorized.</h1>
        <p className="mt-3 text-sm text-muted">
          Add your email to the <code className="bg-mist px-1">ADMIN_EMAILS</code>{" "}
          env var (comma-separated) and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-12">
      <p className="eyebrow text-muted">Admin</p>
      <h1 className="display mt-2 text-4xl">Receipt Approval Hub</h1>
      <p className="mt-2 text-sm text-muted max-w-xl">
        Review bank-transfer receipts uploaded by customers. Approving releases
        the order to fulfillment.
      </p>

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
