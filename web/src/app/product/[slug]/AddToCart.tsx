"use client";

import { useState } from "react";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type Product,
  type SaleUnit,
  type Stitching,
} from "@/lib/types";
import { useCart } from "@/lib/cart-store";
import { formatPKR } from "@/lib/format";

export function AddToCart({ product }: { product: Product }) {
  const [unit, setUnit] = useState<SaleUnit>("meter");
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);

  const unitPrice =
    unit === "meter" ? product.pricePerMeter : product.pricePerSuit;
  const total = unitPrice * quantity;

  return (
    <div className="mt-8 space-y-5">
      <div>
        <p className="eyebrow text-muted mb-2">Sold by</p>
        <div className="grid grid-cols-2 gap-2">
          {(["meter", "suit"] as const).map((u) => (
            <button
              key={u}
              onClick={() => {
                setUnit(u);
              }}
              className={`h-12 border text-sm capitalize transition-colors ${
                unit === u
                  ? "border-ink bg-ink text-paper"
                  : "border-stone hover:border-ink"
              }`}
            >
              <span className="block text-xs eyebrow">By the {u}</span>
              <span className="mt-0.5 block text-xs text-current/80">
                {formatPKR(u === "meter" ? product.pricePerMeter : product.pricePerSuit)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {unit === "meter" && (
        <div className="bg-mist p-3 border border-stone/30 text-xs text-muted leading-relaxed space-y-1">
          <p className="font-semibold text-ink">💡 Shopping by the Meter?</p>
          <p>A complete standard men's suit/garment typically requires a cut of <strong>{product.metersPerSuit} meters</strong>.</p>
        </div>
      )}

      <div>
        <p className="eyebrow text-muted mb-2">
          Quantity {unit === "meter" ? "(meters)" : "(suits)"}
        </p>
        <div className="inline-flex items-center border border-stone">
          <button
            aria-label="Decrease"
            className="h-12 w-12 text-base"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
          >
            −
          </button>
          <span className="px-5 text-sm tabular-nums">{quantity}</span>
          <button
            aria-label="Increase"
            className="h-12 w-12 text-base"
            onClick={() => setQuantity((q) => q + 1)}
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={() => add(product.id, product.slug, unit, quantity, "none")}
        className="btn btn-primary w-full"
        disabled={!product.available}
      >
        {product.available ? `Add to Cart — ${formatPKR(total)}` : "Sold Out"}
      </button>
    </div>
  );
}
