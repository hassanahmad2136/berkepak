import { ProductCard } from "@/components/ProductCard";
import { createSupabaseServer } from "@/lib/supabase/server";
import { getProductByIdAsync } from "@/lib/products";

export default async function WishlistPage() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("wishlist")
    .select("product_id")
    .order("created_at", { ascending: false });

  const items = (
    await Promise.all((data ?? []).map((row) => getProductByIdAsync(row.product_id)))
  ).filter((p): p is NonNullable<typeof p> => Boolean(p));

  return (
    <div>
      <h2 className="display text-2xl">Wishlist</h2>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Save fabrics for later. Your wishlist is empty.
        </p>
      ) : (
        <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
