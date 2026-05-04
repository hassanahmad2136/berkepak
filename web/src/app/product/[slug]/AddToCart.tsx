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
  const [stitching, setStitching] = useState<Stitching>("none");
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);

  const unitPrice =
    unit === "meter" ? product.pricePerMeter : product.pricePerSuit;
  const stitchingAddon =
    stitching === "bespoke" && unit === "suit" ? BESPOKE_STITCHING_ADDON_PKR : 0;
  const total = (unitPrice + stitchingAddon) * quantity;

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
                if (u === "meter") setStitching("none");
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

      {unit === "suit" && (
        <div>
          <p className="eyebrow text-muted mb-2">Stitching</p>
          <div className="grid grid-cols-2 gap-2">
            {(["none", "bespoke"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStitching(s)}
                className={`h-12 border text-sm transition-colors ${
                  stitching === s
                    ? "border-ink bg-ink text-paper"
                    : "border-stone hover:border-ink"
                }`}
              >
                <span className="block text-xs eyebrow">
                  {s === "none" ? "Unstitched" : "Bespoke"}
                </span>
                <span className="mt-0.5 block text-xs text-current/80">
                  {s === "none" ? "—" : `+${formatPKR(BESPOKE_STITCHING_ADDON_PKR)}`}
                </span>
              </button>
            ))}
          </div>
          {stitching === "bespoke" && (
            <p className="mt-2 text-xs text-muted">
              We'll use the measurements saved in your account profile. Save them
              first under Account → Profile.
            </p>
          )}
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
        onClick={() => add(product.id, unit, quantity, stitching)}
        className="btn btn-primary w-full"
        disabled={!product.available}
      >
        {product.available ? `Add to Cart — ${formatPKR(total)}` : "Sold Out"}
      </button>
    </div>
  );
}
