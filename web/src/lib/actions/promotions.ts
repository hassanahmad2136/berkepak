"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rate-limit";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!(await isAdmin(user))) return { ok: false, error: "Not an admin." };
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

  let created: { id: string } | null;
  try {
    created = await queryOne<{ id: string }>(
      `insert into promotions
         (type, title, body, code, discount_type, discount_value,
          min_order_amount, is_active, starts_at, ends_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       returning id`,
      [
        input.type,
        input.title.trim(),
        input.body?.trim() || null,
        input.type === "coupon" ? input.code!.toUpperCase().trim() : null,
        input.discountType ?? null,
        input.discountValue ?? null,
        input.minOrderAmount ?? 0,
        input.isActive,
        input.startsAt || null,
        input.endsAt || null,
      ],
    );
  } catch (err) {
    // 23505 = unique_violation on the promotions.code index.
    const code = (err as { code?: string }).code;
    if (code === "23505") return { ok: false, error: "Promo code already exists." };
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  if (!created) return { ok: false, error: "Promotion could not be created." };

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true, id: created.id };
}

export async function togglePromotion(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(`update promotions set is_active = $1 where id = $2`, [isActive, id]);

  revalidatePath("/admin/promotions");
  revalidatePath("/");
  return { ok: true };
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(`delete from promotions where id = $1`, [id]);

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
  const rateLimit = await checkRateLimit("coupon_validate", 10);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error ?? "Too many requests." };
  }

  if (!code.trim()) return { ok: false, error: "Enter a promo code." };

  const promo = await queryOne<{
    id: string;
    discount_type: string;
    discount_value: string;
    min_order_amount: string;
    starts_at: Date | null;
    ends_at: Date | null;
  }>(
    `select id, discount_type, discount_value, min_order_amount, starts_at, ends_at
       from promotions
      where upper(code) = upper($1) and type = 'coupon' and is_active = true`,
    [code.trim()],
  );

  if (!promo) return { ok: false, error: "Invalid or expired promo code." };

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
