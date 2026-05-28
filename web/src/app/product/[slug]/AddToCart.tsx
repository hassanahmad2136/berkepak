"use client";

import { useState, useEffect } from "react";
import {
  type Product,
  type SaleUnit,
  type Stitching,
} from "@/lib/types";
import { type ProductDiscount } from "@/lib/campaigns";
import { useCart } from "@/lib/cart-store";
import { formatPKR } from "@/lib/format";

interface AddToCartProps {
  product: Product;
  color: string;
  stock: number;
  discount?: ProductDiscount;
}

export function AddToCart({ product, color, stock, discount }: AddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);

  const unitPrice = discount?.discountedPricePerSuit ?? product.pricePerSuit;
  const total = unitPrice * quantity;
  const isOutOfStock = stock === 0;

  // Reset quantity to 1 if the selected color's stock changes or is lower than current quantity
  useEffect(() => {
    if (quantity > stock && stock > 0) {
      setQuantity(stock);
    } else if (stock === 0) {
      setQuantity(1);
    }
  }, [stock]);

  const handleDecrease = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleIncrease = () => {
    setQuantity((q) => (q < stock ? q + 1 : q));
  };

  const handleAddToCart = () => {
    add(product.id, product.slug, "suit", quantity, "none", color, discount?.discountedPricePerSuit);
  };

  return (
    <div className="mt-8 space-y-5">
      <div>
        <p className="eyebrow text-muted mb-2">
          Quantity (suits)
        </p>
        <div className="inline-flex items-center border border-stone bg-white">
          <button
            aria-label="Decrease"
            className="h-12 w-12 text-base disabled:opacity-30 cursor-pointer"
            onClick={handleDecrease}
            disabled={quantity <= 1 || isOutOfStock}
          >
            −
          </button>
          <span className="px-5 text-sm tabular-nums select-none">
            {isOutOfStock ? 0 : quantity}
          </span>
          <button
            aria-label="Increase"
            className="h-12 w-12 text-base disabled:opacity-30 cursor-pointer"
            onClick={handleIncrease}
            disabled={quantity >= stock || isOutOfStock}
          >
            +
          </button>
        </div>
      </div>

      <button
        onClick={handleAddToCart}
        className="btn btn-primary w-full cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!product.available || isOutOfStock}
      >
        {isOutOfStock
          ? "Out of Stock"
          : !product.available
          ? "Sold Out"
          : `Add to Cart — ${formatPKR(total)}`}
      </button>
    </div>
  );
}
