import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug, products } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { AddToCart } from "./AddToCart";

export async function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Fabric not found" };
  const title = `${product.name} — ${product.composition}`;
  const description = `${product.shortDescription} ${product.gsm} GSM ${product.weave} weave in ${product.colorName}. ${formatPKR(product.pricePerMeter)} per meter.`;
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
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = products
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
            >
              <Image
                src={src}
                alt={product.name}
                fill
                priority={i === 0}
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
            <p className="text-2xl">{formatPKR(product.pricePerMeter)}</p>
            <p className="text-xs text-muted uppercase tracking-[0.14em]">/ meter</p>
            <span className="mx-2 text-stone">·</span>
            <p className="text-base">{formatPKR(product.pricePerSuit)}</p>
            <p className="text-xs text-muted uppercase tracking-[0.14em]">/ suit ({product.metersPerSuit}m)</p>
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
              Ships from Karachi within 2 business days. Free domestic shipping
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
