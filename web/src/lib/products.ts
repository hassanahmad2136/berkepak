/**
 * Product data-access layer.
 *
 * Tries Saleor GraphQL first; falls back to the static catalog below
 * when the backend is unavailable or not configured. This means the
 * storefront never shows an empty page regardless of backend status.
 */

import type { Product } from "./types";
import { isSaleorConfigured, saleorFetch, SaleorError } from "./saleor/client";
import { PRODUCTS_QUERY, PRODUCT_BY_SLUG_QUERY } from "./saleor/queries";
import {
  transformProducts,
  transformProduct,
  type SaleorProductsResponse,
  type SaleorSingleProductResponse,
} from "./saleor/transforms";

// ---------------------------------------------------------------------------
// Default channel slug used by the Saleor backend
// ---------------------------------------------------------------------------
const CHANNEL = process.env.NEXT_PUBLIC_SALEOR_CHANNEL ?? "default-channel";

// =========================================================================
// Static fallback catalog (the original 8 products)
// =========================================================================

const STATIC_PRODUCTS: Product[] = [
  {
    id: "p-001",
    slug: "ivory-poplin-cotton",
    name: "Ivory Poplin Cotton",
    category: "cotton",
    weave: "plain",
    gsm: 145,
    threadCount: 220,
    composition: "100% Egyptian Cotton",
    colorName: "Ivory",
    colorHex: "#f4ecd8",
    pricePerMeter: 1850,
    pricePerSuit: 6800,
    metersPerSuit: 3.5,
    images: ["/products/p-001-a.jpg", "/products/p-001-b.jpg"],
    shortDescription: "Crisp, breathable poplin with a quiet sheen.",
    description:
      "An everyday foundation cloth woven from long-staple Egyptian cotton. Tightly spun yarns deliver a clean drape and a subtle, natural sheen — equally at home in summer kurtas and tailored shirting.",
    isNew: true,
    isFeatured: true,
    available: true,
  },
  {
    id: "p-002",
    slug: "graphite-twill-wool",
    name: "Graphite Twill Wool",
    category: "wool",
    weave: "twill",
    gsm: 320,
    composition: "100% Merino Wool",
    colorName: "Graphite",
    colorHex: "#3a3a3a",
    pricePerMeter: 4250,
    pricePerSuit: 15400,
    metersPerSuit: 3.5,
    images: ["/products/p-002-a.jpg", "/products/p-002-b.jpg"],
    shortDescription: "Mid-weight merino with a soft diagonal hand.",
    description:
      "A versatile suiting wool with a fine 2/2 twill. The yarn is mill-finished for a soft hand without sacrificing structure — ideal for jackets, trousers, and unstitched winter sets.",
    isFeatured: true,
    available: true,
  },
  {
    id: "p-003",
    slug: "ecru-european-linen",
    name: "Ecru European Linen",
    category: "linen",
    weave: "plain",
    gsm: 180,
    composition: "100% European Flax Linen",
    colorName: "Ecru",
    colorHex: "#dcd0b6",
    pricePerMeter: 2400,
    pricePerSuit: 8600,
    metersPerSuit: 3.5,
    images: ["/products/p-003-a.jpg", "/products/p-003-b.jpg"],
    shortDescription: "Slow-spun European flax with a lived-in fall.",
    description:
      "Woven in a mid-weight plain construction, this linen settles into a soft, broken-in drape after the first wash. Honest texture, irregular slubs, and a quiet ecru tone.",
    isNew: true,
    available: true,
  },
  {
    id: "p-004",
    slug: "midnight-silk-satin",
    name: "Midnight Silk Satin",
    category: "silk",
    weave: "satin",
    gsm: 95,
    composition: "100% Mulberry Silk",
    colorName: "Midnight",
    colorHex: "#0e1a2b",
    pricePerMeter: 5200,
    pricePerSuit: 18800,
    metersPerSuit: 3.5,
    images: ["/products/p-004-a.jpg", "/products/p-004-b.jpg"],
    shortDescription: "Heavyweight silk with a deep liquid lustre.",
    description:
      "A 19 momme mulberry silk satin with a fluid, weighted drape. The dense satin face produces a deep, mirror-like reflection in low light — reserved for formal kurtas and evening shararas.",
    isFeatured: true,
    available: true,
  },
  {
    id: "p-005",
    slug: "sand-jacquard-blend",
    name: "Sand Jacquard Blend",
    category: "blended",
    weave: "jacquard",
    gsm: 240,
    composition: "60% Cotton / 40% Viscose",
    colorName: "Sand",
    colorHex: "#c8b58a",
    pricePerMeter: 2150,
    pricePerSuit: 7600,
    metersPerSuit: 3.5,
    images: ["/products/p-005-a.jpg", "/products/p-005-b.jpg"],
    shortDescription: "Tonal jacquard with an architectural relief.",
    description:
      "A self-coloured jacquard with a low-relief geometric pattern. The viscose pickup softens the cotton ground for a smooth hand and gentle sheen.",
    available: true,
  },
  {
    id: "p-006",
    slug: "charcoal-dobby-cotton",
    name: "Charcoal Dobby Cotton",
    category: "cotton",
    weave: "dobby",
    gsm: 165,
    threadCount: 180,
    composition: "100% Combed Cotton",
    colorName: "Charcoal",
    colorHex: "#2e2e2e",
    pricePerMeter: 1650,
    pricePerSuit: 6000,
    metersPerSuit: 3.5,
    images: ["/products/p-006-a.jpg", "/products/p-006-b.jpg"],
    shortDescription: "Subtle dobby texture in deep charcoal.",
    description:
      "A finely woven cotton dobby with a textured grid that catches the light at close range while reading solid from across the room.",
    available: true,
  },
  {
    id: "p-007",
    slug: "rust-brushed-flannel",
    name: "Rust Brushed Flannel",
    category: "wool",
    weave: "twill",
    gsm: 380,
    composition: "80% Wool / 20% Cashmere",
    colorName: "Rust",
    colorHex: "#9b4a26",
    pricePerMeter: 4900,
    pricePerSuit: 17600,
    metersPerSuit: 3.5,
    images: ["/products/p-007-a.jpg", "/products/p-007-b.jpg"],
    shortDescription: "Brushed wool-cashmere with a soft halo.",
    description:
      "A heavily brushed flannel with cashmere content for an unusually soft hand. The rust tone has been built up in two dye passes for depth.",
    isNew: true,
    available: true,
  },
  {
    id: "p-008",
    slug: "porcelain-silk-organza",
    name: "Porcelain Silk Organza",
    category: "silk",
    weave: "plain",
    gsm: 60,
    composition: "100% Mulberry Silk",
    colorName: "Porcelain",
    colorHex: "#f1ecdf",
    pricePerMeter: 3800,
    pricePerSuit: 13600,
    metersPerSuit: 3.5,
    images: ["/products/p-008-a.jpg", "/products/p-008-b.jpg"],
    shortDescription: "Crisp, airy organza with a soft glow.",
    description:
      "A finely woven silk organza — sheer, structured, and luminous. Used for layered dupattas, formal overlays, and sculptural sleeves.",
    available: true,
  },
];

// =========================================================================
// In-memory product cache (for synchronous client-side lookups)
// =========================================================================

/**
 * Once the first server-side fetch resolves, we cache the product list
 * in a module-level Map. Client components (`CartDrawer`, `CheckoutFlow`)
 * that need synchronous `getProductById` read from this cache.
 *
 * The cache is always pre-populated with the static products so there is
 * never a period where lookups return undefined unexpectedly.
 */
let cachedProducts: Product[] = STATIC_PRODUCTS;
const productMapById = new Map<string, Product>(
  STATIC_PRODUCTS.map((p) => [p.id, p]),
);
const productMapBySlug = new Map<string, Product>(
  STATIC_PRODUCTS.map((p) => [p.slug, p]),
);

function updateCache(products: Product[]) {
  cachedProducts = products;
  productMapById.clear();
  productMapBySlug.clear();
  for (const p of products) {
    productMapById.set(p.id, p);
    productMapBySlug.set(p.slug, p);
  }
}

// =========================================================================
// Async data-fetching functions (used by Server Components / Actions)
// =========================================================================

/**
 * Fetch all products. Tries Saleor first; falls back to static.
 */
export async function getProducts(): Promise<Product[]> {
  if (!isSaleorConfigured()) return STATIC_PRODUCTS;

  try {
    const data = await saleorFetch<SaleorProductsResponse>(PRODUCTS_QUERY, {
      channel: CHANNEL,
      first: 100,
    });
    const products = transformProducts(data);
    if (products.length > 0) {
      updateCache(products);
      return products;
    }
  } catch (err) {
    if (err instanceof SaleorError) {
      console.warn("[BerkePak] Saleor unavailable, using static catalog:", err.message);
    } else {
      console.warn("[BerkePak] Saleor fetch failed, using static catalog:", err);
    }
  }

  return STATIC_PRODUCTS;
}

/**
 * Fetch a single product by slug. Tries Saleor first; falls back to static.
 */
export async function getProductBySlugAsync(
  slug: string,
): Promise<Product | undefined> {
  if (!isSaleorConfigured()) {
    return STATIC_PRODUCTS.find((p) => p.slug === slug);
  }

  try {
    const data = await saleorFetch<SaleorSingleProductResponse>(
      PRODUCT_BY_SLUG_QUERY,
      { slug, channel: CHANNEL },
    );
    if (data.product) {
      const product = transformProduct(data.product);
      // Update cache entry
      productMapById.set(product.id, product);
      productMapBySlug.set(product.slug, product);
      return product;
    }
  } catch (err) {
    console.warn("[BerkePak] Saleor slug lookup failed, using static:", err);
  }

  return STATIC_PRODUCTS.find((p) => p.slug === slug);
}

/**
 * Fetch a single product by ID. Async variant used by server actions.
 */
export async function getProductByIdAsync(
  id: string,
): Promise<Product | undefined> {
  // For ID-based lookups we use the cached map (populated by getProducts)
  // rather than hitting Saleor again. If the cache is stale, the worst case
  // is a 60-second delay before the next ISR revalidation.
  if (productMapById.has(id)) return productMapById.get(id);

  // If the cache doesn't have it, try a full product fetch to refresh cache.
  await getProducts();
  return productMapById.get(id);
}

/** Async new arrivals. */
export async function getNewArrivalsAsync(): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.isNew);
}

/** Async featured. */
export async function getFeaturedAsync(): Promise<Product[]> {
  const all = await getProducts();
  return all.filter((p) => p.isFeatured);
}

// =========================================================================
// Synchronous accessors (for client components reading cached data)
// =========================================================================

/**
 * Synchronous product array — returns whatever is currently cached.
 * @deprecated Prefer `await getProducts()` in server components.
 */
export const products: Product[] = STATIC_PRODUCTS;

/**
 * Synchronous slug lookup from cache. Used by server components that
 * already called getProducts() earlier.
 */
export function getProductBySlug(slug: string): Product | undefined {
  return productMapBySlug.get(slug) ?? STATIC_PRODUCTS.find((p) => p.slug === slug);
}

/**
 * Synchronous ID lookup from cache. Safe for client components.
 */
export function getProductById(id: string): Product | undefined {
  return productMapById.get(id) ?? STATIC_PRODUCTS.find((p) => p.id === id);
}

/**
 * Synchronous new arrivals from cache.
 * @deprecated Prefer `await getNewArrivalsAsync()` in server components.
 */
export function getNewArrivals(): Product[] {
  return cachedProducts.filter((p) => p.isNew);
}

/**
 * Synchronous featured from cache.
 * @deprecated Prefer `await getFeaturedAsync()` in server components.
 */
export function getFeatured(): Product[] {
  return cachedProducts.filter((p) => p.isFeatured);
}
