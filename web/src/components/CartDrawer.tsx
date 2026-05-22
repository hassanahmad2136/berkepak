"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart, cartSubtotal, lineSubtotal } from "@/lib/cart-store";
import { getProductById, getProductBySlug } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { useEffect, useRef } from "react";

export function CartDrawer() {
  const { isOpen, close, lines, setQuantity, remove } = useCart();

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const subtotal = cartSubtotal(lines);

  return (
    <>
      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={`fixed inset-0 z-40 bg-ink/30 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        role="dialog"
        aria-label="Cart"
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col bg-paper shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between border-b border-stone px-6 py-5">
          <p className="eyebrow">Cart ({lines.length})</p>
          <button onClick={close} aria-label="Close cart" className="link-underline text-sm">
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <p className="display text-2xl">Your cart is empty.</p>
              <p className="mt-2 text-sm text-muted">
                Begin with a swatch — every piece is sold by the suit.
              </p>
              <Link href="/shop" onClick={close} className="btn btn-primary mt-8">
                Shop Fabrics
              </Link>
            </div>
          ) : (
            <ul>
              {lines.map((line) => {
                const product = getProductById(line.productId) ?? (line.productSlug ? getProductBySlug(line.productSlug) : undefined);
                if (!product) return null;
                return (
                  <li
                    key={`${line.productId}-${line.unit}-${line.stitching}`}
                    className="flex gap-4 border-b border-stone px-6 py-5"
                  >
                    <Link
                      href={`/product/${product.slug}`}
                      onClick={close}
                      className="relative aspect-[3/4] w-24 shrink-0 overflow-hidden bg-mist"
                    >
                      <Image
                        src={product.images[0]}
                        alt={product.name}
                        fill
                        sizes="96px"
                        className="object-cover"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Link
                            href={`/product/${product.slug}`}
                            onClick={close}
                            className="text-sm"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-1 text-xs text-muted">
                            {product.colorName} · By the suit
                            {line.stitching === "bespoke" && " · Bespoke stitching"}
                          </p>
                        </div>
                        <p className="text-sm">{formatPKR(lineSubtotal(line))}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center border border-stone">
                          <button
                            aria-label="Decrease"
                            className="h-8 w-8 text-sm"
                            onClick={() =>
                              setQuantity(line.productId, line.unit, line.stitching, line.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <span className="px-3 text-sm tabular-nums">{line.quantity}</span>
                          <button
                            aria-label="Increase"
                            className="h-8 w-8 text-sm"
                            onClick={() =>
                              setQuantity(line.productId, line.unit, line.stitching, line.quantity + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => remove(line.productId, line.unit, line.stitching)}
                          className="text-xs text-muted underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {lines.length > 0 && (
          <footer className="border-t border-stone px-6 py-5">
            <div className="flex items-baseline justify-between">
              <span className="eyebrow">Subtotal</span>
              <span className="text-base">{formatPKR(subtotal)}</span>
            </div>
            <p className="mt-1 text-xs text-muted">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              href="/checkout"
              onClick={close}
              className="btn btn-primary mt-5 w-full"
            >
              Checkout
            </Link>
          </footer>
        )}
      </aside>
    </>
  );
}
