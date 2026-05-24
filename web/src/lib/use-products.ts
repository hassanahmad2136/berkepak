"use client";

import { useEffect, useState } from "react";
import { getProducts } from "./products";
import type { Product } from "./types";

// Module-level cache so the fetch only fires once per page load.
let _cached: Product[] | null = null;
let _promise: Promise<Product[]> | null = null;

export function useProducts(): Product[] {
  const [products, setProducts] = useState<Product[]>(_cached ?? []);

  useEffect(() => {
    if (_cached) {
      setProducts(_cached);
      return;
    }
    if (!_promise) {
      _promise = getProducts().then((p) => {
        _cached = p;
        return p;
      });
    }
    _promise.then(setProducts);
  }, []);

  return products;
}
