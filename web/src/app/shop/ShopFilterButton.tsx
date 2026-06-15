"use client";

import { useState } from "react";
import { ShopFilterDrawer } from "./ShopFilterDrawer";

interface FilterLink {
  label: string;
  href: string;
  active: boolean;
}

interface ShopFilterButtonProps {
  weaveLinks: FilterLink[];
  sortLinks: FilterLink[];
  activeCount: number;
}

export function ShopFilterButton({
  weaveLinks,
  sortLinks,
  activeCount,
}: ShopFilterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs uppercase tracking-[0.14em] border border-stone hover:border-ink transition-colors cursor-pointer"
        aria-label="Open filters"
      >
        Filters
        {activeCount > 0 && (
          <span className="font-medium">· {activeCount}</span>
        )}
      </button>

      <ShopFilterDrawer
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        weaveLinks={weaveLinks}
        sortLinks={sortLinks}
      />
    </>
  );
}
