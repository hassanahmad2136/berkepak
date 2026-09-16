import "server-only";
import { query, queryOne } from "@/lib/db";
import { listedPrice } from "./pricing";
import type { Product } from "./types";

/**
 * Product catalog access. Server-only: it talks to Postgres directly, so client
 * components must go through the server actions in lib/actions/catalog.ts.
 */

interface CatalogRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  weave_type: string | null;
  gsm: number | null;
  thread_count: number | null;
  composition: string | null;
  description: string | null;
  short_description: string | null;
  price_per_meter: string;
  price_per_suit: string;
  meters_per_suit: string;
  images: string[] | null;
  is_new: boolean;
  is_featured: boolean;
  is_active: boolean;
  first_color: string | null;
}

// numeric columns arrive from pg as strings to preserve precision.
const n = (v: string | number | null | undefined): number => Number(v ?? 0);

function mapRow(row: CatalogRow): Product {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category?.toLowerCase() ?? "fabric",
    weave: (row.weave_type?.toLowerCase() ?? "plain") as Product["weave"],
    gsm: row.gsm ?? 0,
    threadCount: row.thread_count ?? undefined,
    composition: row.composition ?? "",
    colorName: row.first_color ?? "Natural",
    colorHex: "#CCCCCC",
    // The storefront shows listed prices; the stored price is kept alongside
    // for bank transfer and for anything that must not see the fee.
    pricePerMeter: listedPrice(n(row.price_per_meter)),
    pricePerSuit: listedPrice(n(row.price_per_suit)),
    basePricePerMeter: n(row.price_per_meter),
    basePricePerSuit: n(row.price_per_suit),
    metersPerSuit: n(row.meters_per_suit),
    images: row.images ?? [],
    shortDescription: row.short_description ?? "",
    description: row.description ?? "",
    isNew: row.is_new,
    isFeatured: row.is_featured,
    available: row.is_active,
    meterVariantId: undefined,
    suitVariantId: undefined,
  };
}

const SELECT = `
  select p.id, p.slug, p.name, p.category, p.weave_type, p.gsm, p.thread_count,
         p.composition, p.description, p.short_description,
         p.price_per_meter, p.price_per_suit, p.meters_per_suit,
         p.images, p.is_new, p.is_featured, p.is_active,
         (select pc.color_name from product_colors pc
           where pc.catalog_id = p.id order by pc.color_name limit 1) as first_color
    from product_catalog p
`;

export async function getProducts(): Promise<Product[]> {
  const rows = await query<CatalogRow>(
    `${SELECT} where p.is_active = true order by p.created_at asc`,
  );
  return rows.map(mapRow);
}

export async function getProductBySlugAsync(slug: string): Promise<Product | null> {
  const row = await queryOne<CatalogRow>(
    `${SELECT} where p.slug = $1 and p.is_active = true`,
    [slug],
  );
  return row ? mapRow(row) : null;
}

export async function getProductByIdAsync(id: string): Promise<Product | null> {
  const row = await queryOne<CatalogRow>(
    `${SELECT} where p.id = $1 and p.is_active = true`,
    [id],
  );
  return row ? mapRow(row) : null;
}

/** Bulk lookup — one round trip for a cart or wishlist. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await query<CatalogRow>(
    `${SELECT} where p.id = any($1::uuid[]) and p.is_active = true`,
    [ids],
  );
  return rows.map(mapRow);
}

export async function getNewArrivalsAsync(): Promise<Product[]> {
  const rows = await query<CatalogRow>(
    `${SELECT} where p.is_active = true and p.is_new = true order by p.created_at desc`,
  );
  return rows.map(mapRow);
}

export async function getFeaturedAsync(): Promise<Product[]> {
  const rows = await query<CatalogRow>(
    `${SELECT} where p.is_active = true and p.is_featured = true order by p.created_at asc`,
  );
  return rows.map(mapRow);
}

export async function getProductColors(
  catalogId: string,
): Promise<Array<{ color_name: string; image_url: string | null; stock: number }>> {
  return query(
    `select color_name, image_url, stock
       from product_colors
      where catalog_id = $1
      order by color_name asc`,
    [catalogId],
  );
}
