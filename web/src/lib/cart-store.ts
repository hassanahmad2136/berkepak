"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type CartLine,
  type Product,
  type SaleUnit,
  type Stitching,
} from "./types";
import { getProductById, getProductBySlug } from "./products";

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
    color?: string,
  ) => void;
  setQuantity: (
    productId: string,
    unit: SaleUnit,
    stitching: Stitching,
    color: string,
    quantity: number,
  ) => void;
  remove: (
    productId: string,
    unit: SaleUnit,
    stitching: Stitching,
    color: string,
  ) => void;
  clear: () => void;
}

const lineKey = (
  productId: string,
  unit: SaleUnit,
  stitching: Stitching,
  color: string,
) => `${productId}::${unit}::${stitching}::${color}`;

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((s) => ({ isOpen: !s.isOpen })),
      add: (
        productId,
        productSlug,
        unit,
        quantity = 1,
        stitching = "none",
        color = "White",
      ) =>
        set((s) => {
          const key = lineKey(productId, unit, stitching, color);
          const existing = s.lines.find(
            (l) =>
              lineKey(l.productId, l.unit, l.stitching, l.color || "White") ===
              key,
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
            lines: [
              ...s.lines,
              { productId, productSlug, unit, quantity, stitching, color },
            ],
            isOpen: true,
          };
        }),
      setQuantity: (productId, unit, stitching, color, quantity) =>
        set((s) => ({
          lines: s.lines
            .map((l) =>
              l.productId === productId &&
              l.unit === unit &&
              l.stitching === stitching &&
              (l.color || "White") === color
                ? { ...l, quantity }
                : l,
            )
            .filter((l) => l.quantity > 0),
        })),
      remove: (productId, unit, stitching, color) =>
        set((s) => ({
          lines: s.lines.filter(
            (l) =>
              !(
                l.productId === productId &&
                l.unit === unit &&
                l.stitching === stitching &&
                (l.color || "White") === color
              ),
          ),
        })),
      clear: () => set({ lines: [] }),
    }),
    {
      name: "berkepak-cart",
      version: 3,
      migrate: (persistedState, version) => {
        let state = persistedState as any;
        if (version < 3) {
          const lines = (state?.lines || []).map((l: any) => ({
            ...l,
            color: l.color || "White",
          }));
          state = { ...state, lines };
        }
        return state;
      },
    },
  ),
);

export function lineSubtotal(line: CartLine, resolvedProduct?: Product): number {
  const product =
    resolvedProduct ??
    getProductById(line.productId) ??
    (line.productSlug ? getProductBySlug(line.productSlug) : undefined);
  if (!product) return 0;
  const unitPrice =
    line.unit === "meter" ? product.pricePerMeter : product.pricePerSuit;
  const addon =
    line.stitching === "bespoke" && line.unit === "suit"
      ? BESPOKE_STITCHING_ADDON_PKR
      : 0;
  return (unitPrice + addon) * line.quantity;
}

export function cartSubtotal(lines: CartLine[], productMap?: Map<string, Product>): number {
  return lines.reduce((sum, l) => sum + lineSubtotal(l, productMap?.get(l.productId)), 0);
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}
