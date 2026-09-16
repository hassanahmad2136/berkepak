"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { query, queryOne } from "@/lib/db";

export async function toggleWishlist(productId: string) {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to save items." };

  const existing = await queryOne<{ product_id: string }>(
    `select product_id from wishlist where user_id = $1 and product_id = $2`,
    [user.id, productId],
  );

  if (existing) {
    await query(`delete from wishlist where user_id = $1 and product_id = $2`, [
      user.id,
      productId,
    ]);
  } else {
    await query(
      `insert into wishlist (user_id, product_id) values ($1, $2)
       on conflict do nothing`,
      [user.id, productId],
    );
  }

  revalidatePath("/account/wishlist");
  return { ok: true, saved: !existing };
}
