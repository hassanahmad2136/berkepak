"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart, cartItemCount } from "@/lib/cart-store";
import { SearchOverlay } from "@/components/SearchOverlay";
import { logoutAction } from "@/lib/actions/auth";

interface SearchableProduct {
  id: string;
  name: string;
  slug: string;
  category: string;
  weave: string;
  composition: string;
  pricePerSuit: number;
  image: string;
}

export function HeaderClient({
  navLinks,
  signedIn,
  isAdmin,
  products = [],
}: {
  navLinks: { href: string; label: string }[];
  signedIn: boolean;
  isAdmin?: boolean;
  products?: SearchableProduct[];
}) {
  const { lines, open } = useCart();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const count = cartItemCount(lines);

  return (
    <header
      className={`sticky top-0 z-40 bg-paper transition-[border-color,backdrop-filter] ${
        scrolled
          ? "border-b border-stone backdrop-blur-md bg-paper/90"
          : "border-b border-transparent"
      }`}
    >
      <div className="border-b border-stone bg-ink text-paper">
        <div className="mx-auto max-w-[1440px] px-4 py-2 text-center text-[11px] tracking-[0.18em] uppercase">
          Free shipping across Pakistan over Rs 10,000 · COD available
        </div>
      </div>
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-6 px-4 sm:px-8">
        <button
          aria-label="Menu"
          className="flex h-8 w-8 items-center justify-center md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
        >
          <svg width="20" height="14" viewBox="0 0 20 14" fill="none">
            <path d="M0 1h20M0 7h20M0 13h20" stroke="currentColor" />
          </svg>
        </button>

        <nav className="hidden items-center gap-8 text-[13px] md:flex">
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="link-underline">
              {l.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/"
          aria-label="Berke Pak — Home"
          className="absolute left-1/2 -translate-x-1/2 flex items-center"
        >
          <Image
            src="/logo.png"
            alt="Berke Pak"
            width={160}
            height={44}
            priority
            className="h-9 w-auto sm:h-10"
          />
        </Link>

        <div className="flex items-center gap-5 text-[13px]">
          <button
            onClick={() => setSearchOpen(true)}
            className="link-underline relative cursor-pointer"
            aria-label="Search fabrics"
          >
            Search
          </button>
          {isAdmin && (
            <Link
              href="/admin"
              className="link-underline font-semibold text-red-700 hover:text-red-900 uppercase tracking-wider text-[11px] block"
            >
              Admin Dashboard
            </Link>
          )}
          {signedIn ? (
            <>
              <Link
                href="/account"
                className="hidden link-underline sm:block"
              >
                Account
              </Link>
              <button
                onClick={() => logoutAction()}
                className="hidden link-underline sm:block cursor-pointer text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="hidden link-underline sm:block"
            >
              Sign in
            </Link>
          )}
          <button
            onClick={open}
            className="link-underline relative"
            aria-label="Cart"
          >
            Cart{count > 0 ? ` (${count})` : ""}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="border-t border-stone md:hidden">
          <nav className="flex flex-col gap-1 px-4 py-4 text-sm">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                className="py-2"
              >
                {l.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileOpen(false);
                setSearchOpen(true);
              }}
              className="py-2 text-left cursor-pointer border-t border-stone mt-2 pt-3"
            >
              Search
            </button>
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMobileOpen(false)}
                className="py-2 font-semibold text-red-700 border-t border-stone mt-2 pt-3"
              >
                Admin Panel
              </Link>
            )}
            {signedIn ? (
              <>
                <Link
                  href="/account"
                  onClick={() => setMobileOpen(false)}
                  className="py-2 border-t border-stone mt-2 pt-3"
                >
                  Account
                </Link>
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    logoutAction();
                  }}
                  className="py-2 text-left cursor-pointer border-t border-stone mt-2 pt-3 text-ink w-full"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="py-2 border-t border-stone mt-2 pt-3"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}

      {/* Modern Predictive Search Overlay */}
      <SearchOverlay
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        products={products}
      />
    </header>
  );
}

