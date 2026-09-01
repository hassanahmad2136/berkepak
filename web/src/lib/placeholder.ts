/** Neutral tile shown wherever a fabric has no photography uploaded yet. */
export const FABRIC_PLACEHOLDER = "/placeholder-fabric.svg";

/**
 * The seeded `/products/p-00X-*.jpg` sample photos were removed (they were stock
 * garment/accessory shots, not Berke Pak fabric). Catalog rows may still carry those
 * paths, so treat them as missing rather than rendering a broken image.
 */
const RETIRED_SAMPLE_IMAGE = /^\/products\//;

export function fabricImage(src?: string | null): string {
  const trimmed = src?.trim();
  if (!trimmed || RETIRED_SAMPLE_IMAGE.test(trimmed)) return FABRIC_PLACEHOLDER;
  return trimmed;
}

/** Drops retired sample images from a gallery array. */
export function fabricGallery(images: string[]): string[] {
  return images.filter((src) => src?.trim() && !RETIRED_SAMPLE_IMAGE.test(src.trim()));
}
