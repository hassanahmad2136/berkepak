"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function toggleWishlist(productId: string) {
  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Sign in to save items." };

  const { data: existing } = await supabase
    .from("wishlist")
    .select("product_id")
    .eq("user_id", userData.user.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", userData.user.id)
      .eq("product_id", productId);
  } else {
    await supabase
      .from("wishlist")
      .insert({ user_id: userData.user.id, product_id: productId });
  }
  revalidatePath("/account/wishlist");
  return { ok: true, saved: !existing };
}
