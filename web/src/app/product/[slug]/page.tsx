import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlugAsync, getProducts, getProductColors } from "@/lib/products";
import { getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import { getActiveCampaigns } from "@/lib/campaigns.server";
import { formatPKR } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { ProductInteractiveClient } from "./ProductInteractiveClient";

export async function generateStaticParams() {
  const allProducts = await getProducts();
  return allProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlugAsync(slug);
  if (!product || !product.available) return { title: "Fabric not found" };
  // Every field below is optional in the catalog — no product currently records
  // a composition or GSM, so build these from whatever is actually present
  // rather than emitting "Name —  — Berke Pak" and "0 GSM".
  const title = [product.name, product.composition].filter(Boolean).join(" — ");
  const description =
    [
      product.shortDescription,
      product.gsm ? `${product.gsm} GSM` : null,
      product.weave ? `${product.weave} weave` : null,
      product.colorName ? `in ${product.colorName}` : null,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() + `. ${formatPKR(product.pricePerSuit)} per suit (${product.metersPerSuit}m).`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      images: product.images.slice(0, 1).map((url) => ({ url })),
    },
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default async function ProductPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const product = await getProductBySlugAsync(slug);
  if (!product || !product.available) notFound();

  // Fetch color varieties and stock from product_colors via catalog_id
  let dbColors: Array<{ color_name: string; image_url: string | null; stock: number }> = [
    { color_name: "White", image_url: null, stock: 10 },
    { color_name: "Black", image_url: null, stock: 10 },
  ];

  try {
    const colorsData = await getProductColors(product.id);
    if (colorsData.length > 0) dbColors = colorsData;
  } catch (err) {
    console.warn("Colour fetch failed on product page, using defaults:", err);
  }

  const [allProducts, campaigns] = await Promise.all([getProducts(), getActiveCampaigns()]);
  const related = allProducts
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const activeCampaign = getCampaignForProduct(product.id, product.category, campaigns);
  const discount = activeCampaign
    ? computeDiscount(product.pricePerSuit, product.pricePerMeter, activeCampaign)
    : undefined;
  // The same suit by direct bank transfer: the stored price, with the same
  // campaign applied to it rather than a fee subtracted after the fact.
  const bankTransferPrice = activeCampaign
    ? computeDiscount(product.basePricePerSuit, product.basePricePerMeter, activeCampaign)
        .discountedPricePerSuit
    : product.basePricePerSuit;

  return (
    <article className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-6 pb-24">
      <nav className="text-xs text-muted mb-6">
        <Link href="/" className="link-underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="link-underline">Shop</Link>
        <span className="mx-2">/</span>
        <span>{product.name}</span>
      </nav>

      <ProductInteractiveClient
        product={product}
        colors={dbColors}
        discount={discount}
        bankTransferPrice={bankTransferPrice}
      />

      {related.length > 0 && (
        <section className="mt-24">
          <p className="eyebrow text-muted">You may also like</p>
          <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => {
              const rc = getCampaignForProduct(p.id, p.category, campaigns);
              const rd = rc ? computeDiscount(p.pricePerSuit, p.pricePerMeter, rc) : undefined;
              return <ProductCard key={p.id} product={p} discount={rd} />;
            })}
          </div>
        </section>
      )}
    </article>
  );
}
