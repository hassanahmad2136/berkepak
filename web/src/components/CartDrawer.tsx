"use client";

import Link from "next/link";
import Image from "next/image";
import { useCart, cartSubtotal, lineSubtotal } from "@/lib/cart-store";
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import { getProductByIdAsync } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";

export function CartDrawer() {
  const { isOpen, close, lines, setQuantity, remove, updatePriceOverride } = useCart();
  const [productMap, setProductMap] = useState<Map<string, Product>>(new Map());

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (lines.length === 0) return;
    const ids = [...new Set(lines.map((l) => l.productId))];
    Promise.all(ids.map((id) => getProductByIdAsync(id))).then((results) => {
      setProductMap((prev) => {
        const next = new Map(prev);
        results.forEach((p, i) => { if (p) next.set(ids[i], p); });
        return next;
      });
    });
  }, [lines]);

  // Re-validate campaign discounts every time the cart opens.
  // Clears stale unitPriceOverride when campaigns expire; updates when they change.
  useEffect(() => {
    if (!isOpen || lines.length === 0) return;
    // Wait until products are loaded into productMap
    const allLoaded = lines.every((l) => productMap.has(l.productId));
    if (!allLoaded) return;

    getActiveCampaigns().then((campaigns) => {
      lines.forEach((line) => {
        const product = productMap.get(line.productId);
        if (!product) return;
        const campaign = getCampaignForProduct(product.id, product.category, campaigns);
        const discount = campaign
          ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)
          : null;
        const freshPrice = discount?.discountedPricePerSuit;
        // Only write if value changed to avoid unnecessary re-renders
        if (freshPrice !== line.unitPriceOverride) {
          updatePriceOverride(
            line.productId,
            line.unit,
            line.stitching,
            line.color || "White",
            freshPrice,
          );
        }
      });
    });
  }, [isOpen, productMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const subtotal = cartSubtotal(lines, productMap);

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
                const product = productMap.get(line.productId);
                if (!product) return null;
                const activeColor = line.color || "White";
                return (
                  <li
                    key={`${line.productId}-${line.unit}-${line.stitching}-${activeColor}`}
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
                            className="text-sm font-medium"
                          >
                            {product.name}
                          </Link>
                          <div className="mt-1 text-xs text-muted flex items-center gap-1.5">
                            <span className="inline-block w-2.5 h-2.5 rounded-full border border-stone/50" style={{
                              backgroundColor: activeColor.toLowerCase() === "white" ? "#ffffff" : 
                                               activeColor.toLowerCase() === "black" ? "#000000" :
                                               activeColor.toLowerCase() === "blue" ? "#0000ff" : 
                                               activeColor.toLowerCase() === "red" ? "#ff0000" :
                                               activeColor.toLowerCase() === "green" ? "#008000" :
                                               activeColor.toLowerCase() === "beige" ? "#f5f5dc" :
                                               activeColor.toLowerCase() === "gray" || activeColor.toLowerCase() === "grey" ? "#808080" : 
                                               "#dddddd"
                            }} />
                            <span>{activeColor} · By the suit</span>
                            {line.stitching === "bespoke" && " · Bespoke"}
                          </div>
                        </div>
                        <p className="text-sm">{formatPKR(lineSubtotal(line, product))}</p>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center border border-stone">
                          <button
                            aria-label="Decrease"
                            className="h-8 w-8 text-sm cursor-pointer"
                            onClick={() =>
                              setQuantity(line.productId, line.unit, line.stitching, activeColor, line.quantity - 1)
                            }
                          >
                            −
                          </button>
                          <span className="px-3 text-sm tabular-nums select-none">{line.quantity}</span>
                          <button
                            aria-label="Increase"
                            className="h-8 w-8 text-sm cursor-pointer"
                            onClick={() =>
                              setQuantity(line.productId, line.unit, line.stitching, activeColor, line.quantity + 1)
                            }
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => remove(line.productId, line.unit, line.stitching, activeColor)}
                          className="text-xs text-muted underline cursor-pointer"
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
