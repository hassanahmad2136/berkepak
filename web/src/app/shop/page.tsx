import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import type { FabricWeave } from "@/lib/types";
import Link from "next/link";
import { ShopFilterButton } from "./ShopFilterButton";

export const metadata: Metadata = {
  title: "All Fabrics",
  description:
    "Browse the full Berke Pak archive of men's unstitched shalwar kameez fabric, sold by the suit.",
};

const WEAVES: FabricWeave[] = ["plain", "twill", "satin", "jacquard", "dobby"];

interface SearchParams {
  weave?: string;
  sort?: string;
}

export default async function ShopPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const activeWeave = params.weave as FabricWeave | undefined;
  const sort = params.sort ?? "featured";

  const [allProducts, campaigns] = await Promise.all([getProducts(), getActiveCampaigns()]);
  let filtered = allProducts.slice();

  if (activeWeave) {
    filtered = filtered.filter((p) => p.weave === activeWeave);
  }
  if (sort === "price-asc") {
    filtered.sort((a, b) => a.pricePerSuit - b.pricePerSuit);
  } else if (sort === "price-desc") {
    filtered.sort((a, b) => b.pricePerSuit - a.pricePerSuit);
  } else if (sort === "new") {
    filtered.sort((a, b) => Number(!!b.isNew) - Number(!!a.isNew));
  }

  const buildHref = (overrides: Partial<SearchParams>) => {
    const next = { ...params, ...overrides };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => {
      if (v && v !== "all") sp.set(k, String(v));
    });
    const qs = sp.toString();
    return qs ? `/shop?${qs}` : "/shop";
  };

  const weaveLinks = [
    { label: "All weaves", href: buildHref({ weave: undefined }), active: !activeWeave },
    ...WEAVES.map((w) => ({
      label: w,
      href: buildHref({ weave: w }),
      active: activeWeave === w,
    })),
  ];

  const sortOptions = [
    { v: "featured", label: "Featured" },
    { v: "new", label: "Newest" },
    { v: "price-asc", label: "Price: Low to High" },
    { v: "price-desc", label: "Price: High to Low" },
  ];

  const sortLinks = sortOptions.map((o) => ({
    label: o.label,
    href: buildHref({ sort: o.v }),
    active: sort === o.v,
  }));

  const activeCount = (activeWeave ? 1 : 0) + (sort !== "featured" ? 1 : 0);

  return (
    <div className="mx-auto max-w-[1440px] px-4 sm:px-8 pt-10 pb-24">
      <div className="flex flex-col gap-3">
        <p className="eyebrow text-muted">The Edit</p>
        <h1 className="display text-4xl sm:text-5xl">All Fabrics</h1>
        <p className="max-w-xl text-sm text-muted">
          Browse our full archive of men&apos;s unstitched shalwar kameez fabric —
          sold by the suit. Refine by weave and price.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        <span className="px-3 py-1.5 text-xs uppercase tracking-[0.14em] border bg-ink text-paper border-ink">
          All
        </span>
      </div>

      <div className="mt-4 lg:hidden">
        <ShopFilterButton
          weaveLinks={weaveLinks}
          sortLinks={sortLinks}
          activeCount={activeCount}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-28 space-y-8 text-sm">
            <div>
              <p className="eyebrow text-muted">Weave</p>
              <ul className="mt-3 space-y-2">
                <li>
                  <Link
                    href={buildHref({ weave: undefined })}
                    className={`link-underline capitalize ${
                      !activeWeave ? "font-medium" : ""
                    }`}
                  >
                    All weaves
                  </Link>
                </li>
                {WEAVES.map((w) => (
                  <li key={w}>
                    <Link
                      href={buildHref({ weave: w })}
                      className={`link-underline capitalize ${
                        activeWeave === w ? "font-medium" : ""
                      }`}
                    >
                      {w}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow text-muted">Sort</p>
              <ul className="mt-3 space-y-2">
                {[
                  { v: "featured", label: "Featured" },
                  { v: "new", label: "Newest" },
                  { v: "price-asc", label: "Price: Low to High" },
                  { v: "price-desc", label: "Price: High to Low" },
                ].map((o) => (
                  <li key={o.v}>
                    <Link
                      href={buildHref({ sort: o.v })}
                      className={`link-underline ${
                        sort === o.v ? "font-medium" : ""
                      }`}
                    >
                      {o.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </aside>

        <div>
          <div className="mb-6 flex items-center justify-between text-xs text-muted">
            <span>{filtered.length} fabrics</span>
          </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted py-12">
              No fabrics match these filters yet.
            </p>
          ) : (
            <div className="grid gap-x-6 gap-y-12 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((p) => {
                const campaign = getCampaignForProduct(p.id, p.category, campaigns);
                const discount = campaign ? computeDiscount(p.pricePerSuit, p.pricePerMeter, campaign) : undefined;
                return <ProductCard key={p.id} product={p} discount={discount} />;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
