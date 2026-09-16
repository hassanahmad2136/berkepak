import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/receipts", label: "Receipts" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/profile", label: "Profile" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/account");
  const greeting = user.fullName?.split(" ")[0] || "back";

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-12">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Welcome {greeting}.</h1>

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
            <LogoutButton />
          </nav>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
