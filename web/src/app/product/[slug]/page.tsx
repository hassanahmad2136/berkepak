import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlugAsync, getProducts } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { ProductCard } from "@/components/ProductCard";
import { createClient } from "@supabase/supabase-js";
import { ProductInteractiveClient } from "./ProductInteractiveClient";

function getAnonSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

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
  if (!product || !product.available) notFound();

  // Fetch color varieties and stock from product_colors via catalog_id
  let dbColors = [
    { color_name: "White", image_url: null, stock: 10 },
    { color_name: "Black", image_url: null, stock: 10 },
  ];

  try {
    const supabase = getAnonSupabase();
    const { data: colorsData } = await supabase
      .from("product_colors")
      .select("color_name, image_url, stock")
      .eq("catalog_id", product.id)
      .order("color_name", { ascending: true });

    if (colorsData && colorsData.length > 0) {
      dbColors = colorsData;
    }
  } catch (err) {
    console.warn("Supabase fetch failed on product page, using defaults:", err);
  }

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

      <ProductInteractiveClient product={product} colors={dbColors} />

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
