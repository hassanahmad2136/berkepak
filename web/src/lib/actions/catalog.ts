"use server";

import { getProductByIdAsync, getProductsByIds } from "@/lib/products";
import { getActiveCampaigns } from "@/lib/campaigns.server";
import type { Product } from "@/lib/types";
import type { Campaign } from "@/lib/campaigns";

/**
 * Catalog reads for client components.
 *
 * The browser used to query Postgres directly through Supabase's REST layer.
 * With a self-hosted database there is no such endpoint — and exposing one
 * would mean re-inventing RLS — so the cart and checkout go through these
 * server actions instead. All catalog data here is public.
 */

export async function fetchProduct(id: string): Promise<Product | null> {
  return getProductByIdAsync(id);
}

export async function fetchProducts(ids: string[]): Promise<Product[]> {
  return getProductsByIds(ids);
}

export async function fetchActiveCampaigns(): Promise<Campaign[]> {
  return getActiveCampaigns();
}
