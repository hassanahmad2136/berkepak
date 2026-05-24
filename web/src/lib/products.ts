// web/src/lib/products.ts
// Product catalog data access — Supabase SDK only (Saleor removed)
import { createClient } from "@supabase/supabase-js";
import type { Product } from "./types";

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

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
  price_per_meter: number;
  price_per_suit: number;
  meters_per_suit: number;
  images: string[];
  is_new: boolean;
  is_featured: boolean;
  is_active: boolean;
  product_colors: Array<{
    id: string;
    color_name: string;
    image_url: string | null;
    stock: number;
  }>;
}

function mapRow(row: CatalogRow): Product {
  const firstColor = row.product_colors?.[0];
  return {
    id:               row.id,
    slug:             row.slug,
    name:             row.name,
    category:         (row.category?.toLowerCase() ?? "cotton") as Product["category"],
    weave:            (row.weave_type?.toLowerCase() ?? "plain") as Product["weave"],
    gsm:              row.gsm ?? 0,
    threadCount:      row.thread_count ?? undefined,
    composition:      row.composition ?? "",
    colorName:        firstColor?.color_name ?? "Natural",
    colorHex:         "#CCCCCC",
    pricePerMeter:    row.price_per_meter,
    pricePerSuit:     row.price_per_suit,
    metersPerSuit:    row.meters_per_suit,
    images:           row.images ?? [],
    shortDescription: row.short_description ?? "",
    description:      row.description ?? "",
    isNew:            row.is_new,
    isFeatured:       row.is_featured,
    available:        row.is_active,
    meterVariantId:   undefined,
    suitVariantId:    undefined,
  };
}

const SELECT_FIELDS = `
  id, slug, name, category, weave_type, gsm, thread_count,
  composition, description, short_description,
  price_per_meter, price_per_suit, meters_per_suit,
  images, is_new, is_featured, is_active,
  product_colors ( id, color_name, image_url, stock )
`;

export async function getProducts(): Promise<Product[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(SELECT_FIELDS)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getProducts: ${error.message}`);
  return (data as CatalogRow[]).map(mapRow);
}

export async function getProductBySlugAsync(slug: string): Promise<Product | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(SELECT_FIELDS)
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return mapRow(data as CatalogRow);
}

export async function getProductByIdAsync(id: string): Promise<Product | null> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(SELECT_FIELDS)
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (error) return null;
  return mapRow(data as CatalogRow);
}

export async function getNewArrivalsAsync(): Promise<Product[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(SELECT_FIELDS)
    .eq("is_active", true)
    .eq("is_new", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getNewArrivalsAsync: ${error.message}`);
  return (data as CatalogRow[]).map(mapRow);
}

export async function getFeaturedAsync(): Promise<Product[]> {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("product_catalog")
    .select(SELECT_FIELDS)
    .eq("is_active", true)
    .eq("is_featured", true);

  if (error) throw new Error(`getFeaturedAsync: ${error.message}`);
  return (data as CatalogRow[]).map(mapRow);
}

// Synchronous helpers — operate on a pre-loaded Product array.
// Callers must fetch with getProducts() first.
export function getProductBySlug(slug: string, products: Product[]): Product | undefined {
  return products.find(p => p.slug === slug);
}

export function getProductById(id: string, products: Product[]): Product | undefined {
  return products.find(p => p.id === id);
}
