import { ProductCard } from "@/components/ProductCard";
import { requireUser } from "@/lib/auth/guards";
import { query } from "@/lib/db";
import { getProductsByIds } from "@/lib/products";

export default async function WishlistPage() {
  const user = await requireUser("/account/wishlist");
  const rows = await query<{ product_id: string }>(
    `select product_id from wishlist where user_id = $1 order by created_at desc`,
    [user.id],
  );
  const items = await getProductsByIds(rows.map((r) => r.product_id));

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
