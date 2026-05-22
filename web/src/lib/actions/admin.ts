"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { saleorFetch, SaleorError } from "@/lib/saleor/client";
import { PRODUCTS_QUERY } from "@/lib/saleor/queries";

export type AdminResult = { ok: true } | { ok: false; error: string };

const CHANNEL = process.env.NEXT_PUBLIC_SALEOR_CHANNEL ?? "default-channel";

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

let cachedChannelId: string | null = null;

async function getChannelId(): Promise<string> {
  if (cachedChannelId) return cachedChannelId;

  const channelSlug = process.env.NEXT_PUBLIC_SALEOR_CHANNEL ?? "default-channel";
  const query = `
    query GetChannel($slug: String!) {
      channel(slug: $slug) {
        id
      }
    }
  `;
  const data = await saleorFetch<{ channel: { id: string } | null }>(query, { slug: channelSlug });
  if (!data.channel) {
    throw new Error(`Channel with slug "${channelSlug}" not found in Saleor.`);
  }
  cachedChannelId = data.channel.id;
  return cachedChannelId;
}

const MUTATION_UPDATE_PRICE = `
  mutation UpdatePrice($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
    productVariantChannelListingUpdate(id: $id, input: $input) {
      variant {
        id
      }
      errors {
        field
        message
        code
      }
    }
  }
`;

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

  try {
    const data = await saleorFetch<{
      products: {
        edges: Array<{
          node: {
            id: string;
            name: string;
            slug: string;
            variants: Array<{
              id: string;
              name: string;
              sku: string | null;
              pricing: {
                price: {
                  gross: {
                    amount: number;
                  };
                } | null;
              } | null;
            }>;
          };
        }>;
      };
    }>(PRODUCTS_QUERY, { channel: CHANNEL, first: 100 }, { cache: "no-store" });

    if (!data?.products?.edges) {
      return { ok: false, error: "No products returned from Saleor." };
    }

    const products = data.products.edges.map(({ node }) => {
      // Find the first variant (since each product has exactly 1 suit variant now)
      const variant = node.variants[0];
      return {
        id: node.id,
        name: node.name,
        slug: node.slug,
        sku: variant?.sku || "",
        price: variant?.pricing?.price?.gross.amount ?? 0,
        variantId: variant?.id || "",
      };
    });

    return { ok: true, products };
  } catch (err: any) {
    console.error("Failed to fetch admin products:", err);
    return { ok: false, error: err.message || "Failed to fetch products from Saleor." };
  }
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

  try {
    const channelId = await getChannelId();
    
    // 1. Update price in Saleor
    const saleorData = await saleorFetch<{
      productVariantChannelListingUpdate: {
        errors: Array<{ field: string; message: string; code: string }>;
      };
    }>(MUTATION_UPDATE_PRICE, {
      id: variantId,
      input: [
        {
          channelId,
          price: newPrice,
        },
      ],
    });

    const errors = saleorData.productVariantChannelListingUpdate?.errors;
    if (errors && errors.length > 0) {
      return { ok: false, error: `Saleor Error: ${errors[0].message}` };
    }

    // 2. Synchronize to Supabase products table
    const admin = createSupabaseAdmin();
    const { error: supabaseErr } = await admin
      .from("products")
      .upsert({
        id: variantId,
        slug,
        name,
        price_per_suit: newPrice,
        updated_at: new Date().toISOString(),
      });

    if (supabaseErr) {
      console.warn("Supabase products sync failed:", supabaseErr);
      return {
        ok: false,
        error: `Saleor updated successfully, but Supabase sync failed. Please ensure the Supabase products table migration has been applied. Details: ${supabaseErr.message}`,
      };
    }

    // 3. Revalidate path to refresh frontend cache
    revalidatePath("/shop");
    revalidatePath(`/product/${slug}`);
    revalidatePath("/admin/pricing");

    return { ok: true };
  } catch (err: any) {
    console.error("Single product price update failed:", err);
    return { ok: false, error: err.message || "Failed to update product price." };
  }
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

  try {
    const productsRes = await getAdminProducts();
    if (!productsRes.ok || !productsRes.products) {
      return { ok: false, error: productsRes.error || "Failed to fetch products for bulk update." };
    }

    const channelId = await getChannelId();
    const admin = createSupabaseAdmin();
    const errors: string[] = [];

    for (const p of productsRes.products) {
      if (!p.variantId) continue;

      let adjustment = 0;
      if (type === "flat") {
        adjustment = amount;
      } else {
        adjustment = p.price * (amount / 100);
      }

      let newPrice = direction === "increase" ? p.price + adjustment : p.price - adjustment;
      
      // Rounding Strategy: nearest 10 PKR
      let roundedPrice = Math.round(newPrice / 10) * 10;
      roundedPrice = Math.max(0, roundedPrice);

      try {
        // 1. Update in Saleor
        const saleorData = await saleorFetch<{
          productVariantChannelListingUpdate: {
            errors: Array<{ field: string; message: string; code: string }>;
          };
        }>(MUTATION_UPDATE_PRICE, {
          id: p.variantId,
          input: [
            {
              channelId,
              price: roundedPrice,
            },
          ],
        });

        const sErrors = saleorData.productVariantChannelListingUpdate?.errors;
        if (sErrors && sErrors.length > 0) {
          errors.push(`Saleor error for ${p.name}: ${sErrors[0].message}`);
          continue;
        }

        // 2. Update in Supabase
        const { error: supabaseErr } = await admin
          .from("products")
          .upsert({
            id: p.variantId,
            slug: p.slug,
            name: p.name,
            price_per_suit: roundedPrice,
            updated_at: new Date().toISOString(),
          });

        if (supabaseErr) {
          errors.push(`Supabase sync failed for ${p.name}: ${supabaseErr.message}`);
        }
      } catch (err: any) {
        errors.push(`Failed to update ${p.name}: ${err.message || err}`);
      }
    }

    // Revalidate paths
    revalidatePath("/shop");
    revalidatePath("/admin/pricing");
    
    if (errors.length > 0) {
      return {
        ok: false,
        error: `Completed with errors. Failed to update ${errors.length} products. Details: ${errors.slice(0, 3).join("; ")}`,
      };
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Bulk price update failed:", err);
    return { ok: false, error: err.message || "Failed to perform bulk price update." };
  }
}
