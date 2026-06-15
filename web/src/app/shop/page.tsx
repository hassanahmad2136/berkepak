import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { getProducts } from "@/lib/products";
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import type { FabricCategory, FabricWeave } from "@/lib/types";
import Link from "next/link";
import { ShopFilterButton } from "./ShopFilterButton";

const CATEGORY_META: Record<string, { title: string; description: string }> = {
  cotton: {
    title: "Cotton Fabrics",
    description: "Egyptian and combed cotton — poplin, voile, dobby weaves. Sold exclusively by the suit.",
  },
  linen: {
    title: "Linen Fabrics",
    description: "European flax linen with a slow-broken-in drape. Mid-weight, sold exclusively by the suit.",
  },
  wool: {
    title: "Wool Fabrics",
    description: "Merino and cashmere-blend suitings. Twills and flannels for tailored jackets and trousers.",
  },
  silk: {
    title: "Silk Fabrics",
    description: "Mulberry silk satins and organzas. Reserved for formal kurtas, shararas, and evening pieces.",
  },
  blended: {
    title: "Blended Fabrics",
    description: "Cotton-viscose and other blends. Tonal jacquards and architectural textures.",
  },
};

export async function generateMetadata(props: {
  searchParams: Promise<{ category?: string }>;
}): Promise<Metadata> {
  const { category } = await props.searchParams;
  const meta = category && CATEGORY_META[category];
  if (meta) return { title: meta.title, description: meta.description };
  return {
    title: "All Fabrics",
    description:
      "Browse the full Berke Pak archive — cotton, linen, wool, silk and blended fabrics, sold exclusively by the suit.",
  };
}

const CATEGORIES: { slug: FabricCategory | "all"; label: string }[] = [
  { slug: "all", label: "All" },
  { slug: "cotton", label: "Cotton" },
  { slug: "linen", label: "Linen" },
  { slug: "wool", label: "Wool" },
  { slug: "silk", label: "Silk" },
  { slug: "blended", label: "Blended" },
];

const WEAVES: FabricWeave[] = ["plain", "twill", "satin", "jacquard", "dobby"];

interface SearchParams {
  category?: string;
  weave?: string;
  sort?: string;
}

export default async function ShopPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const activeCategory = (params.category ?? "all") as FabricCategory | "all";
  const activeWeave = params.weave as FabricWeave | undefined;
  const sort = params.sort ?? "featured";

  const [allProducts, campaigns] = await Promise.all([getProducts(), getActiveCampaigns()]);
  let filtered = allProducts.slice();

  if (activeCategory !== "all") {
    filtered = filtered.filter((p) => p.category === activeCategory);
  }
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
          Browse our full archive — sold exclusively by the suit. Refine
          by composition, weave, and price.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-2">
        {CATEGORIES.map((c) => {
          const isActive = activeCategory === c.slug;
          return (
            <Link
              key={c.slug}
              href={buildHref({ category: c.slug === "all" ? undefined : c.slug })}
              className={`px-3 py-1.5 text-xs uppercase tracking-[0.14em] border transition-colors ${
                isActive
                  ? "bg-ink text-paper border-ink"
                  : "border-stone hover:border-ink"
              }`}
            >
              {c.label}
            </Link>
          );
        })}
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
