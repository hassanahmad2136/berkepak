"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!(await isAdmin(user))) return { ok: false, error: "Not authorized." };
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

  try {
    await query(
      `insert into campaigns
         (name, discount_type, discount_value, scope, category_targets,
          product_targets, priority, is_active, starts_at, ends_at)
       values ($1,$2,$3,$4,$5,$6::uuid[],$7,$8,$9,$10)`,
      [
        input.name.trim(),
        input.discountType,
        input.discountValue,
        input.scope,
        input.scope === "categories" ? (input.categoryTargets ?? []) : [],
        input.scope === "products" ? (input.productTargets ?? []) : [],
        input.priority ?? 0,
        input.isActive ?? true,
        input.startsAt || null,
        input.endsAt || null,
      ],
    );
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function updateCampaign(id: string, input: Partial<CreateCampaignInput>): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // Build the SET list from whichever fields were supplied.
  const sets: string[] = [];
  const values: unknown[] = [];
  const push = (col: string, value: unknown, cast = "") => {
    values.push(value);
    sets.push(`${col} = $${values.length}${cast}`);
  };

  if (input.name !== undefined) push("name", input.name.trim());
  if (input.discountType !== undefined) push("discount_type", input.discountType);
  if (input.discountValue !== undefined) push("discount_value", input.discountValue);
  if (input.scope !== undefined) {
    push("scope", input.scope);
    push("category_targets", input.scope === "categories" ? (input.categoryTargets ?? []) : []);
    push("product_targets", input.scope === "products" ? (input.productTargets ?? []) : [], "::uuid[]");
  }
  if (input.priority !== undefined) push("priority", input.priority);
  if (input.isActive !== undefined) push("is_active", input.isActive);
  if ("startsAt" in input) push("starts_at", input.startsAt || null);
  if ("endsAt" in input) push("ends_at", input.endsAt || null);

  if (sets.length === 0) return { ok: true };

  values.push(id);
  try {
    await query(`update campaigns set ${sets.join(", ")} where id = $${values.length}`, values);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function toggleCampaign(id: string, isActive: boolean): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(`update campaigns set is_active = $1 where id = $2`, [isActive, id]);

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<ActionResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(`delete from campaigns where id = $1`, [id]);

  revalidatePath("/admin/campaigns");
  revalidatePath("/shop");
  revalidatePath("/");
  return { ok: true };
}
