"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type CartLine,
  type SaleUnit,
  type Stitching,
} from "./types";
import { getProductById, getProductBySlug } from "./products";
import type { Product } from "./types";

interface CartState {
  lines: CartLine[];
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  add: (
    productId: string,
    productSlug: string | undefined,
    unit: SaleUnit,
    quantity?: number,
    stitching?: Stitching,
  ) => void;
  setQuantity: (
    productId: string,
    unit: SaleUnit,
    stitching: Stitching,
    quantity: number,
  ) => void;
  remove: (productId: string, unit: SaleUnit, stitching: Stitching) => void;
  clear: () => void;
}

const lineKey = (productId: string, unit: SaleUnit, stitching: Stitching) =>
  `${productId}::${unit}::${stitching}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      add: (productId, productSlug, unit, quantity = 1, stitching = "none") =>
        set((s) => {
          const key = lineKey(productId, unit, stitching);
          const existing = s.lines.find(
            (l) => lineKey(l.productId, l.unit, l.stitching) === key,
          );
          if (existing) {
            return {
              lines: s.lines.map((l) =>
                l === existing ? { ...l, quantity: l.quantity + quantity } : l,
              ),
              isOpen: true,
            };
          }
          return {
            lines: [...s.lines, { productId, productSlug, unit, quantity, stitching }],
            isOpen: true,
          };
        }),
      setQuantity: (productId, unit, stitching, quantity) =>
        set((s) => ({
          lines: s.lines
            .map((l) =>
              l.productId === productId && l.unit === unit && l.stitching === stitching
                ? { ...l, quantity }
                : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      remove: (productId, unit, stitching) =>
        set((s) => ({
          lines: s.lines.filter(
            (l) =>
              !(
                l.productId === productId &&
                l.unit === unit &&
                l.stitching === stitching
              ),
          ),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "berkepak-cart",
      version: 2,
      // Drop pre-stitching cart entries on upgrade so we don't crash on missing field.
      migrate: (state) => ({ ...(state as CartState), lines: [] }),
    },
  ),
);

export function lineSubtotal(line: CartLine, products: Product[]): number {
  const product = getProductById(line.productId, products) ?? (line.productSlug ? getProductBySlug(line.productSlug, products) : undefined);
  if (!product) return 0;
  const unitPrice =
    line.unit === "meter" ? product.pricePerMeter : product.pricePerSuit;
  const addon =
    line.stitching === "bespoke" && line.unit === "suit"
      ? BESPOKE_STITCHING_ADDON_PKR
      : 0;
  return (unitPrice + addon) * line.quantity;
}

export function cartSubtotal(lines: CartLine[], products: Product[]): number {
  return lines.reduce((sum, l) => sum + lineSubtotal(l, products), 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
