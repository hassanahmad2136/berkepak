"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail, isSmtpConfigured } from "@/lib/email";
import { deleteObject, putObject, publicUrl } from "@/lib/storage";
import { sendPaymentConfirmedEmail } from "@/lib/actions/email-actions";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<AdminResult> {
  const user = await getCurrentUser();
  if (!(await isAdmin(user))) return { ok: false, error: "Not an admin." };
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Receipts
// ---------------------------------------------------------------------------

export async function approveReceipt(receiptId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const receipt = await queryOne<{ id: string; order_id: string | null; status: string }>(
    `select id, order_id, status from receipts where id = $1`,
    [receiptId],
  );
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (receipt.status !== "pending") return { ok: false, error: `Already ${receipt.status}.` };

  await query(`update receipts set status = 'approved', reviewed_at = now() where id = $1`, [
    receiptId,
  ]);
  if (receipt.order_id) {
    await query(
      `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
      [receipt.order_id],
    );
  }

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");

  // Non-fatal: tell the customer their payment cleared.
  try {
    if (receipt.order_id) {
      // Left join: a guest order has no user row, and its contact address
      // lives on the order itself. An inner join silently skipped guests.
      const row = await queryOne<{ email: string | null }>(
        `select coalesce(u.email, o.guest_email) as email
           from orders o
           left join users u on u.id = o.user_id
          where o.id = $1`,
        [receipt.order_id],
      );
      if (row?.email) await sendPaymentConfirmedEmail(receipt.order_id, row.email);
    }
  } catch (err) {
    console.error("Receipt approval confirmation email failed:", err);
  }

  return { ok: true };
}

export async function rejectReceipt(receiptId: string, reason: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;
  if (!reason.trim()) return { ok: false, error: "Reason required." };

  const receipt = await queryOne<{ id: string; order_id: string | null; status: string }>(
    `select id, order_id, status from receipts where id = $1`,
    [receiptId],
  );
  if (!receipt) return { ok: false, error: "Receipt not found." };
  if (receipt.status !== "pending") return { ok: false, error: `Already ${receipt.status}.` };

  await query(
    `update receipts set status = 'rejected', reviewed_at = now(), note = $2 where id = $1`,
    [receiptId, reason],
  );
  // Send the order back so the customer can re-upload.
  if (receipt.order_id) {
    await query(`update orders set payment_status = 'awaiting_receipt' where id = $1`, [
      receipt.order_id,
    ]);
  }

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

type AdminProduct = {
  id: string;
  name: string;
  slug: string;
  sku: string;
  price: number;
  variantId: string;
};

export async function getAdminProducts(): Promise<{
  ok: boolean;
  products?: AdminProduct[];
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const rows = await query<{ id: string; name: string; slug: string; price_per_suit: string }>(
    `select id, name, slug, price_per_suit from product_catalog
      where is_active = true order by name asc`,
  );

  return {
    ok: true,
    products: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.slug, // no separate SKU column; slug doubles as SKU
      price: Number(row.price_per_suit),
      variantId: row.id, // client uses variantId as the row key
    })),
  };
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
  if (newPrice > 1_000_000) return { ok: false, error: "Price cannot exceed 1,000,000 PKR." };

  await query(`update product_catalog set price_per_suit = $1 where id = $2`, [
    newPrice,
    variantId,
  ]);

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

  const sign = direction === "increase" ? 1 : -1;

  // Done in one statement so an interruption cannot leave the catalog with
  // half the products repriced.
  try {
    if (type === "flat") {
      await query(
        `update product_catalog
            set price_per_suit = least(1000000, greatest(100, round((price_per_suit + $1) / 10) * 10))
          where is_active = true`,
        [sign * amount],
      );
    } else {
      await query(
        `update product_catalog
            set price_per_suit = least(1000000, greatest(100,
                  round((price_per_suit * (1 + ($1::numeric / 100))) / 10) * 10))
          where is_active = true`,
        [sign * amount],
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Bulk update failed: ${message}` };
  }

  revalidatePath("/shop");
  revalidatePath("/admin/pricing");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Stock / inventory
// ---------------------------------------------------------------------------

export async function getAdminProductsWithVisibility(): Promise<{
  ok: boolean;
  products?: Array<AdminProduct & { available: boolean; images: string[] }>;
  error?: string;
}> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const rows = await query<{
    id: string;
    name: string;
    slug: string;
    price_per_suit: string;
    is_active: boolean;
    images: string[] | null;
  }>(
    `select id, name, slug, price_per_suit, is_active, images
       from product_catalog order by name asc`,
  );

  return {
    ok: true,
    products: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      sku: row.slug,
      price: Number(row.price_per_suit),
      variantId: row.id,
      available: row.is_active,
      images: row.images ?? [],
    })),
  };
}

/**
 * Uploads a product image and returns its public URL. The browser used to write
 * straight into the Supabase storage bucket with the anon key; self-hosted, the
 * S3 credentials stay on the server and the file is relayed through here.
 */
export async function adminUploadProductImage(
  formData: FormData,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const file = formData.get("file");
  const productId = String(formData.get("productId") ?? "new");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a file." };
  }
  if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Image must be under 10 MB." };
  if (!file.type.startsWith("image/")) return { ok: false, error: "That file is not an image." };

  const ext = file.name.split(".").pop() ?? "jpg";
  const key = `${productId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    await putObject("product-images", key, bytes, file.type, { isPublic: true });
  } catch (err) {
    console.error("[admin] product image upload failed:", err);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  return { ok: true, url: publicUrl("product-images", key) };
}

export async function adminAddProductImage(
  productId: string,
  imageUrl: string,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(
    `update product_catalog set images = array_append(images, $1) where id = $2`,
    [imageUrl, productId],
  );
  revalidatePath("/admin/stock");
  revalidatePath("/shop");
  return { ok: true };
}

export async function adminRemoveProductImage(
  productId: string,
  imageUrl: string,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(
    `update product_catalog set images = array_remove(images, $1) where id = $2`,
    [imageUrl, productId],
  );

  // Best-effort object removal; a dangling object is harmless, a failed page is not.
  try {
    const key = new URL(imageUrl).pathname.replace(/^\/product-images\//, "");
    if (key) await deleteObject("product-images", key);
  } catch {
    // External or unparseable URL — nothing to delete.
  }

  revalidatePath("/admin/stock");
  revalidatePath("/shop");
  return { ok: true };
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
  await query(
    `update product_colors set stock = $1 where catalog_id = $2 and color_name = $3`,
    [stock, catalogId, normalized],
  );

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

  const rows = await query<{
    id: string;
    catalog_id: string;
    color_name: string;
    image_url: string | null;
    stock: number;
    product_name: string | null;
  }>(
    `select pc.id, pc.catalog_id, pc.color_name, pc.image_url, pc.stock,
            p.name as product_name
       from product_colors pc
       left join product_catalog p on p.id = pc.catalog_id
      order by pc.color_name asc`,
  );

  return {
    ok: true,
    productColors: rows.map((r) => ({ ...r, product_name: r.product_name ?? "Unknown Product" })),
  };
}

export async function toggleProductVisibility(
  productId: string,
  visible: boolean,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  await query(`update product_catalog set is_active = $1 where id = $2`, [visible, productId]);

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

  let created: { id: string } | null;
  try {
    created = await queryOne<{ id: string }>(
      `insert into product_catalog
         (slug, name, category, price_per_suit, price_per_meter, composition,
          description, short_description, is_active, is_new, is_featured,
          images, weave_type, thread_count)
       values ($1,$2,$3,$4,0,$5,$6,$7,true,false,false,$8,$9,$10)
       returning id`,
      [
        slug,
        name,
        categoryKey,
        pricePerSuit,
        composition,
        description,
        description.length > 120 ? description.slice(0, 117) + "..." : description,
        imageUrl ? [imageUrl] : [],
        weaveType ?? null,
        threadCount ?? null,
      ],
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
  if (!created) return { ok: false, error: "Product could not be created." };

  // White/Black variants are seeded by the product_catalog_seed_colors trigger.

  revalidatePath("/admin/stock");
  revalidatePath("/admin/pricing");
  revalidatePath("/shop");

  await notifyAdminsOfChange(
    "Create New Product",
    `Product: ${name}\nSlug: ${slug}\nCategory: ${categoryKey}\nPrice: ${pricePerSuit} PKR`,
  );
  return { ok: true, productId: created.id };
}

export async function adminDeleteProduct(productId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  // product_colors cascade via the FK.
  await query(`delete from product_catalog where id = $1`, [productId]);

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

  const existing = await queryOne(
    `select id from product_colors where catalog_id = $1 and color_name = $2`,
    [catalogId, normalized],
  );
  if (existing) {
    return { ok: false, error: `Color "${normalized}" already exists for this product.` };
  }

  await query(
    `insert into product_colors (catalog_id, color_name, stock, image_url)
     values ($1, $2, $3, null)`,
    [catalogId, normalized, initialStock],
  );

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

  await query(`delete from product_colors where id = $1`, [colorId]);

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
  if (!isSmtpConfigured()) return;
  const to = process.env.ADMIN_NOTIFY_EMAILS ?? "admin@berkepakfabrics.com";

  try {
    await sendEmail({
      to,
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
  } catch (err) {
    console.error("Failed to send admin notification email:", err);
  }
}
