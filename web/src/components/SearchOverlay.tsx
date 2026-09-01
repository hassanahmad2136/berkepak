"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { formatPKR } from "@/lib/format";
import { fabricImage } from "@/lib/placeholder";

interface SearchableProduct {
  id: string;
  name: string;
  slug: string;
  category?: string;
  weave: string;
  composition: string;
  pricePerSuit: number;
  image: string;
}

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  products: SearchableProduct[];
}

export function SearchOverlay({ isOpen, onClose, products }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      // Prevent body scrolling
      document.body.style.overflow = "hidden";
      // Small timeout to guarantee DOM is ready
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    } else {
      document.body.style.overflow = "";
      setQuery("");
    }
  }, [isOpen]);

  // Handle ESC key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const normalizedQuery = query.trim().toLowerCase();

  const matchedProducts = normalizedQuery
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(normalizedQuery) ||
          p.composition.toLowerCase().includes(normalizedQuery) ||
          p.weave.toLowerCase().includes(normalizedQuery)
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto backdrop-blur-xl bg-paper/95 px-4 sm:px-8 py-10 transition-all duration-300 ease-out fade-in">
      <div className="mx-auto max-w-[900px] w-full flex flex-col h-full min-h-[80vh]">
        {/* Header Close button */}
        <div className="flex justify-end mb-6 sm:mb-10">
          <button
            onClick={onClose}
            className="link-underline text-xs uppercase tracking-[0.18em] cursor-pointer"
            aria-label="Close search overlay"
          >
            Close (Esc)
          </button>
        </div>

        {/* Input bar */}
        <div className="relative border-b border-stone/80 pb-3 flex items-center">
          <input
            ref={inputRef}
            type="text"
            className="w-full text-2xl sm:text-4xl md:text-5xl font-light tracking-tight focus:outline-none bg-transparent placeholder-stone/50 text-ink"
            placeholder="Search fabrics..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search inputs"
          />
          {query && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="text-xs text-muted hover:text-ink mr-2 cursor-pointer uppercase tracking-wider"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dynamic results layout */}
        <div className="mt-10 flex-1">
          {/* Fabric detail matches */}
          <main className="flex-1">
            <p className="eyebrow text-muted text-[11px] mb-4">
              {query ? `Matches (${matchedProducts.length})` : "Featured Fabrics"}
            </p>

            {!query ? (
              // Initial suggestion view
              <div className="grid gap-3 sm:grid-cols-2">
                {products.slice(0, 4).map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug}`}
                    onClick={onClose}
                    className="flex gap-4 p-3 border border-stone/30 bg-white hover:border-stone-500 hover:shadow-xs transition-all duration-300"
                  >
                    <div className="relative aspect-[3/4] w-14 shrink-0 bg-mist overflow-hidden">
                      {p.image !== undefined ? (
                        <Image
                          src={fabricImage(p.image)}
                          alt={p.name}
                          fill
                          sizes="56px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-mist" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 text-sm">
                      <p className="font-semibold truncate">{p.name}</p>
                      <p className="text-xs text-muted mt-0.5 truncate capitalize">
                        {p.weave} · {p.composition}
                      </p>
                      <p className="text-xs font-medium text-ink mt-1.5">
                        {formatPKR(p.pricePerSuit)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : matchedProducts.length === 0 ? (
              // Empty search state
              <div className="py-12 text-center sm:text-left">
                <p className="display text-xl sm:text-2xl text-ink-soft">
                  No fabrics found.
                </p>
                <p className="text-sm text-muted mt-2">
                  Try a different spelling, or search by fabric name or weave.
                </p>
              </div>
            ) : (
              // Real-time matched results view
              <div className="grid gap-3 sm:grid-cols-2 max-h-[55vh] overflow-y-auto pr-1">
                {matchedProducts.map((p) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.slug}`}
                    onClick={onClose}
                    className="flex gap-4 p-3 border border-stone/30 bg-white hover:border-stone-500 hover:shadow-xs transition-all duration-300 fade-up"
                  >
                    <div className="relative aspect-[3/4] w-16 shrink-0 bg-mist overflow-hidden">
                      {p.image !== undefined ? (
                        <Image
                          src={fabricImage(p.image)}
                          alt={p.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                        />
                      ) : (
                        <div className="h-full w-full bg-mist" />
                      )}
                    </div>
                    <div className="flex flex-col justify-center min-w-0 text-sm">
                      <p className="font-semibold truncate text-ink">{p.name}</p>
                      <p className="text-xs text-muted mt-0.5 truncate capitalize">
                        {p.weave} · {p.composition}
                      </p>
                      <p className="text-xs font-semibold text-ink mt-2">
                        {formatPKR(p.pricePerSuit)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
