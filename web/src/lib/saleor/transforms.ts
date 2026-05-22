/**
 * Transforms raw Saleor GraphQL response shapes into the storefront's
 * `Product` interface so every existing UI component keeps working
 * without modification.
 */

import type { FabricCategory, FabricWeave, Product } from "@/lib/types";

// ---------------------------------------------------------------------------
// Saleor response types (subset — only what we read)
// ---------------------------------------------------------------------------

interface SaleorAttributeValue {
  name: string;
  value: string | null;
}

interface SaleorAttribute {
  attribute: { slug: string };
  values: SaleorAttributeValue[];
}

interface SaleorMedia {
  url: string;
  alt: string;
}

interface SaleorVariant {
  id: string;
  name: string;
  sku: string | null;
  quantityAvailable: number | null;
  pricing: {
    price: {
      gross: {
        amount: number;
        currency: string;
      };
    } | null;
  } | null;
}

export interface SaleorProductNode {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoDescription: string | null;
  isAvailableForPurchase: boolean | null;
  media: SaleorMedia[];
  attributes: SaleorAttribute[];
  variants: SaleorVariant[];
  productType: { slug: string };
}

export interface SaleorProductsResponse {
  products: {
    edges: Array<{ node: SaleorProductNode }>;
  };
}

export interface SaleorSingleProductResponse {
  product: SaleorProductNode | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Pull the first value for an attribute by slug. */
function attr(
  attributes: SaleorAttribute[],
  slug: string,
): string | undefined {
  const match = attributes.find((a) => a.attribute.slug === slug);
  if (!match || match.values.length === 0) return undefined;
  // Prefer `value` (raw); fall back to `name` (display label)
  return match.values[0].value ?? match.values[0].name;
}

/** Parse a numeric attribute, returning a fallback if unparsable. */
function numericAttr(
  attributes: SaleorAttribute[],
  slug: string,
  fallback = 0,
): number {
  const raw = attr(attributes, slug);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  return Number.isNaN(n) ? fallback : n;
}

/** Boolean attribute: "true" / "1" → true, everything else → false. */
function boolAttr(attributes: SaleorAttribute[], slug: string): boolean {
  const raw = attr(attributes, slug);
  if (!raw) return false;
  return raw === "true" || raw === "1";
}

/**
 * Extract price from a variant by matching its name/sku against a pattern.
 * Falls back to the first variant's price if no match.
 */
function variantPrice(
  variants: SaleorVariant[],
  pattern: string,
): number {
  const match = variants.find(
    (v) =>
      v.name.toLowerCase().includes(pattern) ||
      (v.sku ?? "").toLowerCase().includes(pattern),
  );
  const chosen = match ?? variants[0];
  return chosen?.pricing?.price?.gross.amount ?? 0;
}

function variantId(
  variants: SaleorVariant[],
  pattern: string,
): string | undefined {
  const match = variants.find(
    (v) =>
      v.name.toLowerCase().includes(pattern) ||
      (v.sku ?? "").toLowerCase().includes(pattern),
  );
  return match?.id;
}

// ---------------------------------------------------------------------------
// Main transform
// ---------------------------------------------------------------------------

/**
 * Convert a Saleor product node into the storefront `Product` shape.
 *
 * Attribute slug conventions (must match Saleor dashboard configuration):
 *   category, weave, gsm, thread-count, composition, color-name, color-hex,
 *   meters-per-suit, is-new, is-featured
 */
export function transformProduct(node: SaleorProductNode): Product {
  const a = node.attributes;

  const pricePerMeter = variantPrice(node.variants, "meter");
  const pricePerSuit = variantPrice(node.variants, "suit");
  const metersPerSuit = numericAttr(a, "meters-per-suit", 3.5);

  // Build a short description from seoDescription or the first 120 chars
  // of the full description (which is JSON rich-text in Saleor).
  let shortDesc = node.seoDescription ?? "";
  let fullDesc = "";

  if (node.description) {
    try {
      // Saleor stores descriptions as EditorJS JSON. Extract plain text.
      const parsed = JSON.parse(node.description);
      const blocks: Array<{ data?: { text?: string } }> =
        parsed.blocks ?? [];
      fullDesc = blocks
        .map((b) => b.data?.text ?? "")
        .filter(Boolean)
        .join(" ");
    } catch {
      // If it's just plain text, use it as-is.
      fullDesc = node.description;
    }
  }

  if (!shortDesc && fullDesc) {
    shortDesc =
      fullDesc.length > 120 ? fullDesc.slice(0, 117) + "…" : fullDesc;
  }

  // Image URLs — Saleor serves them from its media root. We prepend the
  // API origin if the URL is relative.
  const apiOrigin = (
    process.env.NEXT_PUBLIC_SALEOR_API_URL ?? ""
  ).replace(/\/graphql\/?$/, "");

  const images = node.media.map((m) =>
    m.url.startsWith("http") ? m.url : `${apiOrigin}${m.url}`,
  );

  return {
    id: node.id,
    slug: node.slug,
    name: node.name,
    category: (attr(a, "category") ?? "cotton") as FabricCategory,
    weave: (attr(a, "weave") ?? "plain") as FabricWeave,
    gsm: numericAttr(a, "gsm"),
    threadCount: numericAttr(a, "thread-count") || undefined,
    composition: attr(a, "composition") ?? "",
    colorName: attr(a, "color-name") ?? "",
    colorHex: attr(a, "color-hex") ?? "#cccccc",
    pricePerMeter,
    pricePerSuit: pricePerSuit || pricePerMeter * metersPerSuit,
    metersPerSuit,
    images: images.length > 0 ? images : ["/products/placeholder.jpg"],
    shortDescription: shortDesc,
    description: fullDesc || shortDesc,
    isNew: boolAttr(a, "is-new"),
    isFeatured: boolAttr(a, "is-featured"),
    available: node.isAvailableForPurchase ?? true,
    meterVariantId: variantId(node.variants, "meter"),
    suitVariantId: variantId(node.variants, "suit"),
  };
}

/**
 * Transform the full `products` query response into a `Product[]`.
 */
export function transformProducts(data: SaleorProductsResponse): Product[] {
  return data.products.edges.map((edge) => transformProduct(edge.node));
}
