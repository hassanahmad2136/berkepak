"use client";

import Link from "next/link";
import { useEffect } from "react";

interface FilterLink {
  label: string;
  href: string;
  active: boolean;
}

interface ShopFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  weaveLinks: FilterLink[];
  sortLinks: FilterLink[];
}

export function ShopFilterDrawer({
  isOpen,
  onClose,
  weaveLinks,
  sortLinks,
}: ShopFilterDrawerProps) {
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden={!isOpen}
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-[var(--color-ink)]/40 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Drawer panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filters"
        className={`fixed bottom-0 left-0 right-0 z-50 bg-[var(--color-paper)] border-t border-[var(--color-stone)] px-6 pt-5 pb-8 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-in-out ${
          isOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close filters"
          className="absolute top-4 right-4 text-sm leading-none cursor-pointer"
        >
          ✕
        </button>

        <div className="space-y-7 text-sm">
          {/* Weave section */}
          <div>
            <p className="eyebrow text-muted">Weave</p>
            <ul className="mt-3 space-y-2">
              {weaveLinks.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`link-underline capitalize ${link.active ? "font-medium" : ""}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Sort section */}
          <div>
            <p className="eyebrow text-muted">Sort</p>
            <ul className="mt-3 space-y-2">
              {sortLinks.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    onClick={onClose}
                    className={`link-underline ${link.active ? "font-medium" : ""}`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
