"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | AdminResult> {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) return { ok: false, error: "Not an admin." };
  return { ok: true };
}

export async function approveReceipt(receiptId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { data: receipt, error: fetchErr } = await admin
    .from("receipts")
    .select("id, order_id, status")
    .eq("id", receiptId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (receipt.status !== "pending") {
    return { ok: false, error: `Already ${receipt.status}.` };
  }

  const now = new Date().toISOString();
  const { error: rErr } = await admin
    .from("receipts")
    .update({ status: "approved", reviewed_at: now })
    .eq("id", receiptId);
  if (rErr) return { ok: false, error: rErr.message };

  const { error: oErr } = await admin
    .from("orders")
    .update({ payment_status: "paid", status: "confirmed" })
    .eq("id", receipt.order_id);
  if (oErr) return { ok: false, error: oErr.message };

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function rejectReceipt(
  receiptId: string,
  reason: string,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!reason.trim()) return { ok: false, error: "Reason required." };

  const admin = createSupabaseAdmin();
  const { data: receipt, error: fetchErr } = await admin
    .from("receipts")
    .select("id, order_id, status")
    .eq("id", receiptId)
    .maybeSingle();
  if (fetchErr) return { ok: false, error: fetchErr.message };
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (receipt.status !== "pending") {
    return { ok: false, error: `Already ${receipt.status}.` };
  }

  const now = new Date().toISOString();
  const { error: rErr } = await admin
    .from("receipts")
    .update({ status: "rejected", reviewed_at: now, notes: reason })
    .eq("id", receiptId);
  if (rErr) return { ok: false, error: rErr.message };

  // Revert order to awaiting_receipt so customer can re-upload.
  const { error: oErr } = await admin
    .from("orders")
    .update({ payment_status: "awaiting_receipt" })
    .eq("id", receipt.order_id);
  if (oErr) return { ok: false, error: oErr.message };

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pricing admin — Supabase product_catalog only
// ---------------------------------------------------------------------------

export async function getAdminProducts(): Promise<{
  ok: boolean;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    price: number;
    variantId: string;
  }>;
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error || "Not an admin." };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("product_catalog")
    .select("id, name, slug, price_per_suit")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const products = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    sku: row.slug as string,       // no separate SKU column; slug doubles as SKU
    price: row.price_per_suit as number,
    variantId: row.id as string,   // client uses variantId as the row key
  }));

  return { ok: true, products };
}

export async function updateSingleProductPrice(
  variantId: string,
  slug: string,
  name: string,
  newPrice: number,
): Promise<AdminResult> {
  const rateLimit = await checkRateLimit("admin_pricing", 30);
  if (!rateLimit.success) return { ok: false, error: rateLimit.error || "Rate limit exceeded" };

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("product_catalog")
    .update({ price_per_suit: newPrice, updated_at: new Date().toISOString() })
    .eq("id", variantId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/shop");
  revalidatePath(`/product/${slug}`);
  revalidatePath("/admin/pricing");

  return { ok: true };
}

export async function bulkUpdatePrices(
  type: "flat" | "percent",
  amount: number,
  direction: "increase" | "decrease",
): Promise<AdminResult> {
  const rateLimit = await checkRateLimit("admin_pricing", 10);
  if (!rateLimit.success) return { ok: false, error: rateLimit.error || "Rate limit exceeded" };

  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const productsRes = await getAdminProducts();
  if (!productsRes.ok || !productsRes.products) {
    return { ok: false, error: productsRes.error || "Failed to fetch products for bulk update." };
  }

  const admin = createSupabaseAdmin();
  const errors: string[] = [];

  for (const p of productsRes.products) {
    let adjustment = type === "flat" ? amount : p.price * (amount / 100);
    let newPrice = direction === "increase" ? p.price + adjustment : p.price - adjustment;
    // Round to nearest 10 PKR, clamp to 0
    const roundedPrice = Math.max(0, Math.round(newPrice / 10) * 10);

    const { error } = await admin
      .from("product_catalog")
      .update({ price_per_suit: roundedPrice, updated_at: new Date().toISOString() })
      .eq("id", p.id);

    if (error) {
      errors.push(`Failed to update ${p.name}: ${error.message}`);
    }
  }

  revalidatePath("/shop");
  revalidatePath("/admin/pricing");

  if (errors.length > 0) {
    return {
      ok: false,
      error: `Completed with errors. Failed to update ${errors.length} products. Details: ${errors.slice(0, 3).join("; ")}`,
    };
  }

  return { ok: true };
}
