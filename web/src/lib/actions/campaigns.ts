"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult> {
  const ok = await isCurrentUserAdmin();
  if (!ok) return { ok: false, error: "Not authorized." };
  return { ok: true };
}

export type CreateCampaignInput = {
  name: string;
  discountType: "pct" | "fixed";
  discountValue: number;
  scope: "all" | "categories" | "products";
  categoryTargets?: string[];
  productTargets?: string[];
  priority?: number;
  isActive?: boolean;
  startsAt?: string;
  endsAt?: string;
};

function validateInput(input: CreateCampaignInput): string | null {
  if (!input.name.trim()) return "Campaign name is required.";
  if (input.discountValue <= 0) return "Discount value must be positive.";
  if (input.discountType === "pct" && input.discountValue > 100) return "Percentage discount cannot exceed 100.";
  if (input.scope === "categories" && !input.categoryTargets?.length) return "Select at least one category.";
  if (input.scope === "products" && !input.productTargets?.length) return "Select at least one product.";
  if (input.startsAt && input.endsAt && new Date(input.startsAt) >= new Date(input.endsAt)) {
    return "End date must be after start date.";
  }
  return null;
}

export async function createCampaign(input: CreateCampaignInput): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const err = validateInput(input);
  if (err) return { ok: false, error: err };

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("campaigns").insert({
    name: input.name.trim(),
    discount_type: input.discountType,
    discount_value: input.discountValue,
    scope: input.scope,
    category_targets: input.scope === "categories" ? (input.categoryTargets ?? []) : [],
    product_targets: input.scope === "products" ? (input.productTargets ?? []) : [],
    priority: input.priority ?? 0,
    is_active: input.isActive ?? true,
    starts_at: input.startsAt || null,
    ends_at: input.endsAt || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCampaign(id: string, input: Partial<CreateCampaignInput>): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.discountType !== undefined) patch.discount_type = input.discountType;
  if (input.discountValue !== undefined) patch.discount_value = input.discountValue;
  if (input.scope !== undefined) {
    patch.scope = input.scope;
    patch.category_targets = input.scope === "categories" ? (input.categoryTargets ?? []) : [];
    patch.product_targets = input.scope === "products" ? (input.productTargets ?? []) : [];
  }
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.isActive !== undefined) patch.is_active = input.isActive;
  if ("startsAt" in input) patch.starts_at = input.startsAt || null;
  if ("endsAt" in input) patch.ends_at = input.endsAt || null;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("campaigns").update(patch).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleCampaign(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("campaigns").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("campaigns").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}
