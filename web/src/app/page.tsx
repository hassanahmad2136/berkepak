import Link from "next/link";
import Image from "next/image";
import { ProductCard } from "@/components/ProductCard";
import { getNewArrivalsAsync, getFeaturedAsync, getProducts } from "@/lib/products";

export default async function HomePage() {
  const [newArrivals, featured, allProducts] = await Promise.all([
    getNewArrivalsAsync(),
    getFeaturedAsync(),
    getProducts(),
  ]);
  const fabricOfMonth = featured[0];

  return (
    <>
      <section className="relative h-[88dvh] w-full overflow-hidden">
        <Image
          src="/hero/banner-1.jpg"
          alt="Editorial fabric drape"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/40" />
        <div className="relative z-10 mx-auto flex h-full max-w-[1440px] flex-col justify-end px-4 pb-16 sm:px-8 sm:pb-24 text-paper fade-up">
          <p className="eyebrow">Spring Edit · Volume IV</p>
          <h1 className="display mt-4 text-5xl sm:text-7xl lg:text-8xl max-w-4xl">
            Quiet luxury,<br />by the meter.
          </h1>
          <p className="mt-6 max-w-md text-sm text-paper/85">
            Editorial fabrics for the discerning — sourced from heritage mills,
            sold without compromise.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/shop" className="btn btn-primary !border-paper !bg-paper !text-ink">
              Shop the Edit
            </Link>
            <Link
              href="/shop?category=silk"
              className="btn btn-ghost !border-paper !text-paper hover:!bg-paper hover:!text-ink"
            >
              Discover Silk
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1440px] px-4 sm:px-8 py-20">
        <div className="flex items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-muted">New Arrivals</p>
            <h2 className="display mt-2 text-3xl sm:text-4xl">
              Fresh off the loom
            </h2>
          </div>
          <Link href="/shop" className="link-underline text-sm">
            View all
          </Link>
        </div>
        <div className="mt-10 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {newArrivals.slice(0, 4).map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      </section>

      {fabricOfMonth && (
        <section className="bg-mist">
          <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-0 lg:grid-cols-2">
            <div className="relative aspect-[4/5] lg:aspect-auto lg:min-h-[640px]">
              <Image
                src={fabricOfMonth.images[0]}
                alt={fabricOfMonth.name}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>
            <div className="flex items-center justify-center px-8 py-16 lg:px-20">
              <div className="max-w-md">
                <p className="eyebrow text-muted">Fabric of the Month</p>
                <h2 className="display mt-3 text-4xl sm:text-5xl">
                  {fabricOfMonth.name}
                </h2>
                <p className="mt-6 text-sm text-ink-soft leading-relaxed">
                  {fabricOfMonth.description}
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
                  <dt className="text-muted">Weave</dt>
                  <dd className="capitalize">{fabricOfMonth.weave}</dd>
                  <dt className="text-muted">Weight</dt>
                  <dd>{fabricOfMonth.gsm} GSM</dd>
                  <dt className="text-muted">Composition</dt>
                  <dd>{fabricOfMonth.composition}</dd>
                  <dt className="text-muted">Colour</dt>
                  <dd>{fabricOfMonth.colorName}</dd>
                </dl>
                <Link
                  href={`/product/${fabricOfMonth.slug}`}
                  className="btn btn-primary mt-10"
                >
                  Discover
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-[1440px] px-4 sm:px-8 py-20">
        <p className="eyebrow text-muted">By Composition</p>
        <h2 className="display mt-2 text-3xl sm:text-4xl">Browse by material</h2>
        <div className="mt-10 grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4">
          {[
            { slug: "cotton", label: "Cotton", img: allProducts[0]?.images[0] ?? "/products/p-001-a.jpg" },
            { slug: "linen", label: "Linen", img: allProducts[2]?.images[0] ?? "/products/p-003-a.jpg" },
            { slug: "wool", label: "Wool", img: allProducts[1]?.images[0] ?? "/products/p-002-a.jpg" },
            { slug: "silk", label: "Silk", img: allProducts[3]?.images[0] ?? "/products/p-004-a.jpg" },
          ].map((c) => (
            <Link
              key={c.slug}
              href={`/shop?category=${c.slug}`}
              className="group relative block aspect-[3/4] overflow-hidden bg-mist"
            >
              <Image
                src={c.img}
                alt={c.label}
                fill
                sizes="(min-width: 1024px) 25vw, 50vw"
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-ink/10 transition-colors group-hover:bg-ink/30" />
              <span className="absolute bottom-5 left-5 text-paper display text-2xl">
                {c.label}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-y border-stone">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-8 py-16 grid gap-10 sm:grid-cols-3 text-sm">
          <div>
            <p className="eyebrow">Ships from Lahore</p>
            <p className="mt-3 text-muted">
              Free domestic shipping over Rs 10,000. Worldwide DHL on request (coming soon).
            </p>
          </div>
          <div>
            <p className="eyebrow">COD &amp; Bank Transfer</p>
            <p className="mt-3 text-muted">
              Pay on delivery with OTP verification, or via Raast / IBAN
              transfer with manual receipt review.
            </p>
          </div>
          <div>
            <p className="eyebrow">Heritage Quality</p>
            <p className="mt-3 text-muted">
              Sourced directly from historical craft regions, curated to ensure the finest weaves.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
