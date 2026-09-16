"use client";

import React, { useState } from "react";
import Image from "next/image";
import { FABRIC_PLACEHOLDER, fabricGallery } from "@/lib/placeholder";
import Link from "next/link";
import { type Product } from "@/lib/types";
import { type ProductDiscount } from "@/lib/campaigns";
import { formatPKR } from "@/lib/format";
import { AddToCart } from "./AddToCart";

interface ProductColor {
  color_name: string;
  image_url: string | null;
  stock: number;
}

interface ProductInteractiveClientProps {
  product: Product;
  colors: ProductColor[];
  discount?: ProductDiscount;
  /** Price per suit by direct bank transfer, which carries no gateway fee. */
  bankTransferPrice: number;
}

export function ProductInteractiveClient({
  product,
  colors,
  discount,
  bankTransferPrice,
}: ProductInteractiveClientProps) {
  // Try to find a matching default color or fallback to first color or White
  const initialColor =
    colors.find(
      (c) => c.color_name.toLowerCase() === product.colorName.toLowerCase()
    )?.color_name ||
    colors[0]?.color_name ||
    "White";

  const [selectedColor, setSelectedColor] = useState<string>(initialColor);

  const selectedColorSpec = colors.find((c) => c.color_name === selectedColor);
  const currentStock = selectedColorSpec ? selectedColorSpec.stock : 0;

  // Compute dynamic gallery images. Prepend color specific image if it exists.
  const galleryImages = fabricGallery(product.images);
  if (selectedColorSpec?.image_url) {
    const url = selectedColorSpec.image_url;
    if (!galleryImages.includes(url)) {
      galleryImages.unshift(url);
    } else {
      const idx = galleryImages.indexOf(url);
      galleryImages.splice(idx, 1);
      galleryImages.unshift(url);
    }
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
      {/* Gallery Section */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {galleryImages.length === 0 && (
          <div className="relative aspect-[4/5] bg-mist overflow-hidden sm:col-span-2">
            <Image
              src={FABRIC_PLACEHOLDER}
              alt={product.name}
              fill
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
        {galleryImages.map((src, i) => (
          <div
            key={src}
            className={`relative aspect-[3/4] bg-mist overflow-hidden ${
              i === 0 ? "sm:col-span-2 sm:aspect-[4/5]" : ""
            }`}
            style={
              i === 0
                ? ({ viewTransitionName: `product-image-${product.id}` } as React.CSSProperties)
                : undefined
            }
          >
            <Image
              src={src}
              alt={`${product.name} - ${selectedColor}`}
              fill
              priority={i === 0}
              fetchPriority={i === 0 ? "high" : "low"}
              sizes="(min-width: 1024px) 60vw, 100vw"
              className="object-cover transition-all duration-300"
            />
          </div>
        ))}
      </div>

      {/* Info Details Section */}
      <div className="lg:sticky lg:top-28 lg:self-start">
        <p className="eyebrow text-muted">Unstitched Suit</p>
        <h1 className="display mt-2 text-4xl sm:text-5xl">{product.name}</h1>

        <div className="mt-6 flex items-baseline gap-3 flex-wrap">
          {discount ? (
            <>
              <p className="text-2xl font-semibold text-ink">{formatPKR(discount.discountedPricePerSuit)}</p>
              <p className="text-base text-muted line-through">{formatPKR(product.pricePerSuit)}</p>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                {discount.label}
              </span>
            </>
          ) : (
            <p className="text-2xl">{formatPKR(product.pricePerSuit)}</p>
          )}
          <p className="text-xs text-muted uppercase tracking-[0.14em]">/ suit</p>
        </div>

        {bankTransferPrice < (discount?.discountedPricePerSuit ?? product.pricePerSuit) && (
          <p className="mt-2 text-sm text-muted">
            or <span className="font-medium text-ink">{formatPKR(bankTransferPrice)}</span> by
            direct bank transfer
          </p>
        )}

        <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone/40 bg-stone/5 px-3 py-1 text-xs text-muted">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
          <span>{product.metersPerSuit} meters standard cut</span>
        </div>

        <p className="mt-6 text-sm text-ink-soft leading-relaxed">
          {product.description}
        </p>

        {/* Dynamic Color Swatch Selector */}
        <div className="mt-8">
          <span className="eyebrow text-muted">Select Color Variation</span>
          <div className="mt-3 flex flex-wrap gap-2.5">
            {colors.map((c) => {
              const isActive = selectedColor === c.color_name;
              const isOutOfStock = c.stock === 0;

              return (
                <button
                  key={c.color_name}
                  type="button"
                  onClick={() => setSelectedColor(c.color_name)}
                  className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? "border-ink bg-ink text-paper"
                      : "border-stone bg-white hover:bg-stone-50 text-ink"
                  } ${isOutOfStock ? "opacity-60" : ""}`}
                >
                  <span
                    className="inline-block w-3.5 h-3.5 rounded-full border border-stone/50 shadow-xs"
                    style={{
                      backgroundColor:
                        c.color_name.toLowerCase() === "white"
                          ? "#ffffff"
                          : c.color_name.toLowerCase() === "black"
                          ? "#000000"
                          : c.color_name.toLowerCase() === "blue"
                          ? "#0000ff"
                          : c.color_name.toLowerCase() === "red"
                          ? "#ff0000"
                          : c.color_name.toLowerCase() === "green"
                          ? "#008000"
                          : c.color_name.toLowerCase() === "beige"
                          ? "#f5f5dc"
                          : c.color_name.toLowerCase() === "gray" ||
                            c.color_name.toLowerCase() === "grey"
                          ? "#808080"
                          : "#dddddd",
                    }}
                  />
                  <span>{c.color_name}</span>
                  {isOutOfStock && (
                    <span className="text-[9px] uppercase font-bold text-red-700 ml-0.5">(Sold Out)</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Dynamic Stock Indicator */}
          {selectedColorSpec && (
            <div className="mt-3.5">
              {currentStock === 0 ? (
                <p className="text-xs font-semibold text-red-700">
                  Currently out of stock. Please select another color.
                </p>
              ) : currentStock <= 2 ? (
                <p className="text-xs font-semibold text-amber-700 animate-pulse">
                  Only {currentStock} suit{currentStock > 1 ? "s" : ""} left in stock!
                </p>
              ) : (
                <p className="text-xs text-muted">In stock &amp; ready to ship.</p>
              )}
            </div>
          )}
        </div>

        {/* Add to Cart Actions */}
        <AddToCart product={product} color={selectedColor} stock={currentStock} discount={discount} />

        <dl className="mt-10 grid grid-cols-2 gap-y-3 gap-x-6 border-t border-stone pt-6 text-sm">
          <dt className="text-muted">Composition</dt>
          <dd>{product.composition}</dd>
          <dt className="text-muted">Weave</dt>
          <dd className="capitalize">{product.weave}</dd>
          <dt className="text-muted">Weight</dt>
          <dd>{product.gsm} GSM</dd>
          {product.threadCount && (
            <>
              <dt className="text-muted">Thread Count</dt>
              <dd>{product.threadCount}</dd>
            </>
          )}
          <dt className="text-muted">Per Suit</dt>
          <dd>{product.metersPerSuit} meters</dd>
          <dt className="text-muted">Care</dt>
          <dd>Dry clean recommended</dd>
        </dl>

        <details className="mt-6 border-t border-stone pt-4 text-sm">
          <summary className="cursor-pointer list-none flex justify-between select-none font-medium">
            <span>Shipping &amp; Returns</span>
            <span aria-hidden>+</span>
          </summary>
          <p className="mt-3 text-muted leading-relaxed">
            Ships from Lahore within 2 business days. Free domestic shipping over Rs 10,000. Returns accepted on uncut lengths within 7 days.
          </p>
        </details>
      </div>
    </div>
  );
}
