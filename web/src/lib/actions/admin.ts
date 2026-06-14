"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import nodemailer from "nodemailer";
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";

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

  // Non-fatal: send order confirmation email to customer now that payment is confirmed.
  try {
    const { data: orderData } = await admin
      .from("orders")
      .select("user_id")
      .eq("id", receipt.order_id)
      .single();
    if (orderData?.user_id) {
      const { data: userData } = await admin.auth.admin.getUserById(orderData.user_id);
      if (userData?.user?.email) {
        await sendOrderConfirmationEmail(receipt.order_id, userData.user.email);
      }
    }
  } catch (err) {
    console.error("Receipt approval confirmation email failed:", err);
  }

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

  if (!Number.isFinite(newPrice) || newPrice < 100) {
    return { ok: false, error: "Price must be at least 100 PKR." };
  }
  if (newPrice > 1_000_000) {
    return { ok: false, error: "Price cannot exceed 1,000,000 PKR." };
  }

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

  // Compute all new prices first, then send a single batch upsert so a
  // mid-loop interruption cannot leave the catalog with split pricing.
  const updates = productsRes.products.map((p) => {
    const adjustment = type === "flat" ? amount : p.price * (amount / 100);
    const newPrice = direction === "increase" ? p.price + adjustment : p.price - adjustment;
    const roundedPrice = Math.min(1_000_000, Math.max(100, Math.round(newPrice / 10) * 10));
    return { id: p.id, price_per_suit: roundedPrice, updated_at: new Date().toISOString() };
  });

  const { error } = await admin.from("product_catalog").upsert(updates);
  if (error) return { ok: false, error: `Bulk update failed: ${error.message}` };

  revalidatePath("/shop");
  revalidatePath("/admin/pricing");

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock / Inventory admin — Supabase product_catalog only
// ---------------------------------------------------------------------------

export async function getAdminProductsWithVisibility(): Promise<{
  ok: boolean;
  products?: Array<{
    id: string;
    name: string;
    slug: string;
    sku: string;
    price: number;
    variantId: string;
    available: boolean;
  }>;
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error || "Not an admin." };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("product_catalog")
    .select("id, name, slug, price_per_suit, is_active")
    .order("name", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const products = (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    sku: row.slug as string,
    price: row.price_per_suit as number,
    variantId: row.id as string,
    available: row.is_active as boolean,
  }));

  return { ok: true, products };
}

export async function updateProductColorStock(
  catalogId: string,
  colorName: string,
  stock: number,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (stock < 0) return { ok: false, error: "Stock cannot be negative." };

  const normalized = colorName.trim();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("product_colors")
    .update({ stock })
    .eq("catalog_id", catalogId)
    .eq("color_name", normalized);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  await notifyAdminsOfChange(
    "Update Color Stock",
    `Catalog ID: ${catalogId}\nColor: ${normalized}\nNew Stock: ${stock}`,
  );

  return { ok: true };
}

export async function getProductColorsForAdmin(): Promise<{
  ok: boolean;
  productColors?: Array<{
    id: string;
    catalog_id: string;
    color_name: string;
    image_url: string | null;
    stock: number;
    product_name?: string;
  }>;
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("product_colors")
    .select("id, catalog_id, color_name, image_url, stock, product_catalog(name)")
    .order("color_name", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const formatted = (data ?? []).map((item: any) => ({
    id: item.id,
    catalog_id: item.catalog_id,
    color_name: item.color_name,
    image_url: item.image_url,
    stock: item.stock,
    product_name: item.product_catalog?.name ?? "Unknown Product",
  }));

  return { ok: true, productColors: formatted };
}

export async function toggleProductVisibility(
  productId: string,
  visible: boolean,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("product_catalog")
    .update({ is_active: visible, updated_at: new Date().toISOString() })
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Toggle Product Visibility",
    `Product ID: ${productId}\nVisible: ${visible}`,
  );

  return { ok: true };
}

export async function adminCreateProduct(
  name: string,
  slug: string,
  categoryKey: string,
  pricePerSuit: number,
  composition: string,
  description: string,
  imageUrl?: string | null,
  weaveType?: string | null,
  threadCount?: number | null,
): Promise<{ ok: boolean; productId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("product_catalog")
    .insert({
      slug,
      name,
      category: categoryKey,
      price_per_suit: pricePerSuit,
      price_per_meter: 0,
      composition,
      description,
      short_description:
        description.length > 120 ? description.slice(0, 117) + "..." : description,
      is_active: true,
      is_new: false,
      is_featured: false,
      images: imageUrl ? [imageUrl] : [],
      weave_type: weaveType ?? null,
      thread_count: threadCount ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  // Seed default White and Black color variants
  await admin.from("product_colors").insert([
    { catalog_id: data.id, color_name: "White", stock: 10, image_url: null },
    { catalog_id: data.id, color_name: "Black", stock: 10, image_url: null },
  ]);

  revalidatePath("/admin/stock");
  revalidatePath("/admin/pricing");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Create New Product",
    `Product: ${name}\nSlug: ${slug}\nCategory: ${categoryKey}\nPrice: ${pricePerSuit} PKR`,
  );

  return { ok: true, productId: data.id };
}

export async function adminDeleteProduct(productId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  // Cascade deletes product_colors automatically via FK ON DELETE CASCADE
  const { error } = await admin
    .from("product_catalog")
    .delete()
    .eq("id", productId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/admin/pricing");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Delete Product",
    `Product ID: ${productId} permanently deleted from product_catalog (colors cascade-deleted).`,
  );

  return { ok: true };
}

export async function addProductColor(
  catalogId: string,
  colorName: string,
  initialStock: number,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const normalized = colorName.trim();
  if (!normalized) return { ok: false, error: "Color name is required." };
  if (initialStock < 0) return { ok: false, error: "Stock cannot be negative." };

  const admin = createSupabaseAdmin();

  const { data: existing } = await admin
    .from("product_colors")
    .select("id")
    .eq("catalog_id", catalogId)
    .eq("color_name", normalized)
    .maybeSingle();

  if (existing) return { ok: false, error: `Color "${normalized}" already exists for this product.` };

  const { error } = await admin.from("product_colors").insert({
    catalog_id: catalogId,
    color_name: normalized,
    stock: initialStock,
    image_url: null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Add Product Color",
    `Catalog ID: ${catalogId}\nColor: ${normalized}\nInitial Stock: ${initialStock}`,
  );

  return { ok: true };
}

export async function removeProductColor(colorId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const admin = createSupabaseAdmin();
  const { error } = await admin.from("product_colors").delete().eq("id", colorId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");
  revalidatePath("/shop");

  await notifyAdminsOfChange("Remove Product Color", `Color ID: ${colorId} deleted.`);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function notifyAdminsOfChange(actionName: string, details: string) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "465");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"BerkePak Fabrics" <${smtpUser}>`,
        to: "admin@berkepakfabrics.com, abdullahahmad@berkepakfabrics.com",
        subject: `Admin Action Alert: ${escapeHtml(actionName)}`,
        html: `
          <div style="font-family:sans-serif;padding:20px;background:#fafaf9;color:#1c1917;">
            <div style="max-width:600px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;border:1px solid #e7e5e4;">
              <h2 style="font-size:20px;font-weight:700;color:#b91c1c;margin-bottom:20px;border-bottom:2px solid #f5f5f4;padding-bottom:10px;">
                Admin Action Logged
              </h2>
              <p style="font-size:14px;margin-bottom:12px;"><strong>Action:</strong> ${escapeHtml(actionName)}</p>
              <p style="font-size:14px;margin-bottom:12px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
              <div style="background:#f5f5f4;padding:15px;border-radius:6px;font-family:monospace;font-size:13px;white-space:pre-wrap;margin-top:15px;border-left:4px solid #b91c1c;">
                ${escapeHtml(details)}
              </div>
            </div>
          </div>
        `,
      });
    } catch (err: any) {
      console.error("Failed to send admin notification email:", err);
    }
  }
}
