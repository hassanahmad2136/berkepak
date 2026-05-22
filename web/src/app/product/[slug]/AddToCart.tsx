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
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);

  const unitPrice = product.pricePerSuit;
  const total = unitPrice * quantity;

  return (
    <div className="mt-8 space-y-5">
      <div>
        <p className="eyebrow text-muted mb-2">
          Quantity (suits)
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
        onClick={() => add(product.id, product.slug, "suit", quantity, "none")}
        className="btn btn-primary w-full"
        disabled={!product.available}
      >
        {product.available ? `Add to Cart — ${formatPKR(total)}` : "Sold Out"}
      </button>
    </div>
  );
}
