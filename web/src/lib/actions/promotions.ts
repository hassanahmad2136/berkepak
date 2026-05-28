"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "Not an admin." };
  return { ok: true };
}

export type CreatePromotionInput = {
  type: "banner" | "coupon";
  title: string;
  body?: string;
  code?: string;
  discountType?: "pct" | "fixed";
  discountValue?: number;
  minOrderAmount?: number;
  isActive: boolean;
  startsAt?: string;
  endsAt?: string;
};

export async function createPromotion(input: CreatePromotionInput): Promise<ActionResult & { id?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (!input.title.trim()) return { ok: false, error: "Title is required." };
  if (input.type === "coupon") {
    if (!input.code?.trim()) return { ok: false, error: "Coupon code is required." };
    if (!input.discountType) return { ok: false, error: "Discount type is required for coupons." };
    if (!input.discountValue || input.discountValue <= 0) return { ok: false, error: "Discount value must be positive." };
    if (input.discountType === "pct" && input.discountValue > 100) return { ok: false, error: "Percentage discount cannot exceed 100." };
  }

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("promotions")
    .insert({
      type: input.type,
      title: input.title.trim(),
      body: input.body?.trim() || null,
      code: input.type === "coupon" ? input.code!.toUpperCase().trim() : null,
      discount_type: input.discountType ?? null,
      discount_value: input.discountValue ?? null,
      min_order_amount: input.minOrderAmount ?? 0,
      is_active: input.isActive,
      starts_at: input.startsAt || null,
      ends_at: input.endsAt || null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, error: "Promo code already exists." };
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true, id: data.id };
}

export async function togglePromotion(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("promotions")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("promotions")
    .delete()
    .eq("id", id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export type ValidateCouponResult =
  | { ok: true; promoId: string; discountAmount: number; code: string }
  | { ok: false; error: string };

export async function validateCoupon(
  code: string,
  subtotal: number,
): Promise<ValidateCouponResult> {
  if (!code.trim()) return { ok: false, error: "Enter a promo code." };

  const admin = createSupabaseAdmin();
  const { data: promo, error } = await admin
    .from("promotions")
    .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
    .eq("code", code.toUpperCase().trim())
    .eq("type", "coupon")
    .eq("is_active", true)
    .maybeSingle();

  if (error || !promo) return { ok: false, error: "Invalid or expired promo code." };

  const now = new Date();
  if (promo.starts_at && new Date(promo.starts_at) > now) {
    return { ok: false, error: "Promo code is not yet active." };
  }
  if (promo.ends_at && new Date(promo.ends_at) < now) {
    return { ok: false, error: "Promo code has expired." };
  }
  if (Number(promo.min_order_amount) > 0 && subtotal < Number(promo.min_order_amount)) {
    return { ok: false, error: `Minimum order of PKR ${promo.min_order_amount} required.` };
  }

  const discountAmount =
    promo.discount_type === "pct"
      ? Math.floor(subtotal * (Number(promo.discount_value) / 100))
      : Math.min(Number(promo.discount_value), subtotal);

  return { ok: true, promoId: promo.id, discountAmount, code: code.toUpperCase().trim() };
}
