import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlugAsync, getProducts } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "./AddToCart";

export async function generateStaticParams() {
  const allProducts = await getProducts();
  return allProducts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await getProductBySlugAsync(slug);
  if (!product) return { title: "Fabric not found" };
  const title = `${product.name} — ${product.composition}`;
  const description = `${product.shortDescription} ${product.gsm} GSM ${product.weave} weave in ${product.colorName}. ${formatPKR(product.pricePerSuit)} per suit (${product.metersPerSuit}m).`;
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
  if (!product) notFound();

  const allProducts = await getProducts();
  const related = allProducts
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4);

  return (
    <article className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-6 pb-24">
      <nav className="text-xs text-muted mb-6">
        <Link href="/" className="link-underline">Home</Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="link-underline">Shop</Link>
        <span className="mx-2">/</span>
        <span className="capitalize">{product.category}</span>
      </nav>

      <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {product.images.map((src, i) => (
            <div
              key={src}
              className={`relative aspect-[3/4] bg-mist overflow-hidden ${
                i === 0 ? "sm:col-span-2 sm:aspect-[4/5]" : ""
              }`}
              style={i === 0 ? ({ viewTransitionName: `product-image-${product.id}` } as React.CSSProperties) : undefined}
            >
              <Image
                src={src}
                alt={product.name}
                fill
                priority={i === 0}
                fetchPriority={i === 0 ? "high" : "low"}
                sizes="(min-width: 1024px) 60vw, 100vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-28 lg:self-start">
          <p className="eyebrow text-muted capitalize">{product.category}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">{product.name}</h1>

          <div className="mt-6 flex items-baseline gap-3">
            <p className="text-2xl">{formatPKR(product.pricePerSuit)}</p>
            <p className="text-xs text-muted uppercase tracking-[0.14em]">/ suit</p>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone/40 bg-stone/5 px-3 py-1 text-xs text-muted">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            <span>{product.metersPerSuit} meters standard cut</span>
          </div>

          <p className="mt-6 text-sm text-ink-soft leading-relaxed">
            {product.description}
          </p>

          <div className="mt-8 flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className="inline-block h-5 w-5 rounded-full border border-stone"
              style={{ background: product.colorHex }}
            />
            <span>{product.colorName}</span>
          </div>

          <AddToCart product={product} />

          <dl className="mt-10 grid grid-cols-2 gap-y-3 gap-x-6 border-t border-stone pt-6 text-sm">
            <dt className="text-muted">Composition</dt>
            <dd>{product.composition}</dd>
            <dt className="text-muted">Weave</dt>
            <dd className="capitalize">{product.weave}</dd>
            <dt className="text-muted">Weight</dt>
            <dd>{product.gsm} GSM</dd>
            {product.threadCount && (
              <>
                <dt className="text-muted">Thread Count</dt>
                <dd>{product.threadCount}</dd>
              </>
            )}
            <dt className="text-muted">Per Suit</dt>
            <dd>{product.metersPerSuit} meters</dd>
            <dt className="text-muted">Care</dt>
            <dd>Dry clean recommended</dd>
          </dl>

          <details className="mt-6 border-t border-stone pt-4 text-sm">
            <summary className="cursor-pointer list-none flex justify-between">
              <span>Shipping &amp; Returns</span>
              <span aria-hidden>+</span>
            </summary>
            <p className="mt-3 text-muted leading-relaxed">
              Ships from Lahore within 2 business days. Free domestic shipping
              over Rs 10,000. Returns accepted on uncut lengths within 7 days.
            </p>
          </details>
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-24">
          <p className="eyebrow text-muted">You may also like</p>
          <div className="mt-6 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
