"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { saleorFetch, SaleorError, isSaleorConfigured } from "@/lib/saleor/client";
import { PRODUCTS_QUERY } from "@/lib/saleor/queries";
import { getProducts } from "@/lib/products";
import nodemailer from "nodemailer";

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

  await notifyAdminsOfChange(
    "Approve Payment Receipt",
    `Receipt ID: ${receiptId}\nOrder ID: ${receipt?.order_id}\nStatus: Approved`
  );

  // Send automated email to the customer
  try {
    const { data: orderDetails } = await admin
      .from("orders")
      .select("user_id, total")
      .eq("id", receipt.order_id)
      .maybeSingle();

    if (orderDetails && orderDetails.user_id) {
      const { data: userRecord } = await admin.auth.admin.getUserById(orderDetails.user_id);
      const customerEmail = userRecord?.user?.email;
      
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", orderDetails.user_id)
        .maybeSingle();

      if (customerEmail) {
        await sendCustomerVerificationEmail(
          customerEmail,
          profile?.full_name || "Valued Customer",
          receipt.order_id,
          "approved",
          orderDetails.total
        );
      }
    }
  } catch (emailErr) {
    console.error("Failed to fetch customer info or send email on receipt approval:", emailErr);
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

  await notifyAdminsOfChange(
    "Reject Payment Receipt",
    `Receipt ID: ${receiptId}\nOrder ID: ${receipt?.order_id}\nStatus: Rejected\nReason: ${reason}`
  );

  // Send automated email to the customer
  try {
    const { data: orderDetails } = await admin
      .from("orders")
      .select("user_id, total")
      .eq("id", receipt.order_id)
      .maybeSingle();

    if (orderDetails && orderDetails.user_id) {
      const { data: userRecord } = await admin.auth.admin.getUserById(orderDetails.user_id);
      const customerEmail = userRecord?.user?.email;
      
      const { data: profile } = await admin
        .from("profiles")
        .select("full_name")
        .eq("id", orderDetails.user_id)
        .maybeSingle();

      if (customerEmail) {
        await sendCustomerVerificationEmail(
          customerEmail,
          profile?.full_name || "Valued Customer",
          receipt.order_id,
          "rejected",
          orderDetails.total,
          reason
        );
      }
    }
  } catch (emailErr) {
    console.error("Failed to fetch customer info or send email on receipt rejection:", emailErr);
  }

  return { ok: true };
}

async function sendCustomerVerificationEmail(
  toEmail: string,
  customerName: string,
  orderId: string,
  status: "approved" | "rejected",
  totalAmount: number,
  rejectReason?: string
) {
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
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      const subject = status === "approved"
        ? `✅ Payment Confirmed: Order #${orderId} has been verified!`
        : `⚠️ Payment Action Required: Order #${orderId} receipt issue`;

      const title = status === "approved"
        ? "Payment Verified Successfully"
        : "Payment Verification Action Required";

      const htmlContent = status === "approved"
        ? `
          <div style="font-family: sans-serif; padding: 20px; background-color: #fafaf9; color: #1c1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e7e5e4;">
              <h2 style="font-size: 20px; font-weight: 700; color: #15803d; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f5f5f4; padding-bottom: 10px;">
                ${title}
              </h2>
              <p style="font-size: 14px; line-height: 1.5;">Dear ${customerName},</p>
              <p style="font-size: 14px; line-height: 1.5;">Great news! We have successfully verified your bank transfer payment proof for <strong>Order #${orderId}</strong>.</p>
              <div style="background-color: #f5f5f4; padding: 15px; border-radius: 6px; font-size: 13px; margin: 20px 0; border-left: 4px solid #15803d;">
                <p style="margin: 0 0 5px 0;"><strong>Order ID:</strong> #${orderId}</p>
                <p style="margin: 0 0 5px 0;"><strong>Amount Paid:</strong> Rs. ${totalAmount.toLocaleString()}</p>
                <p style="margin: 0;"><strong>Payment Status:</strong> PAID (Verified)</p>
              </div>
              <p style="font-size: 14px; line-height: 1.5;">Our fulfillment team is now preparing your high-quality fabrics. You will receive a tracking link via email and SMS as soon as your package is dispatched.</p>
              <p style="font-size: 14px; line-height: 1.5; margin-top: 25px;">Warm regards,<br /><strong>BerkePak Fabrics</strong></p>
              <p style="font-size: 11px; color: #78716c; margin-top: 30px; text-align: center; border-top: 1px solid #f5f5f4; padding-top: 15px;">
                This is an automated transaction email from BerkePak Fabrics.
              </p>
            </div>
          </div>
        `
        : `
          <div style="font-family: sans-serif; padding: 20px; background-color: #fafaf9; color: #1c1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e7e5e4;">
              <h2 style="font-size: 20px; font-weight: 700; color: #b91c1c; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f5f5f4; padding-bottom: 10px;">
                ${title}
              </h2>
              <p style="font-size: 14px; line-height: 1.5;">Dear ${customerName},</p>
              <p style="font-size: 14px; line-height: 1.5;">We encountered an issue while verifying your bank transfer receipt for <strong>Order #${orderId}</strong>.</p>
              <div style="background-color: #fef2f2; padding: 15px; border-radius: 6px; font-size: 13px; margin: 20px 0; border-left: 4px solid #b91c1c; color: #991b1b;">
                <p style="margin: 0 0 5px 0;"><strong>Order ID:</strong> #${orderId}</p>
                <p style="margin: 0 0 5px 0;"><strong>Status:</strong> Verification Declined</p>
                <p style="margin: 0;"><strong>Reason:</strong> ${rejectReason || "Unreadable screenshot or incomplete transfer."}</p>
              </div>
              <p style="font-size: 14px; line-height: 1.5;">Please log in to your account and re-upload a clear proof of payment at your Receipts panel so we can confirm and dispatch your order immediately.</p>
              <p style="font-size: 14px; line-height: 1.5; margin-top: 25px;">Warm regards,<br /><strong>BerkePak Fabrics</strong></p>
              <p style="font-size: 11px; color: #78716c; margin-top: 30px; text-align: center; border-top: 1px solid #f5f5f4; padding-top: 15px;">
                This is an automated transaction email from BerkePak Fabrics.
              </p>
            </div>
          </div>
        `;

      await transporter.sendMail({
        from: `"BerkePak Fabrics" <${smtpUser}>`,
        to: toEmail,
        subject: subject,
        html: htmlContent,
      });
      console.log(`Successfully dispatched customer notification email to ${toEmail} for order #${orderId}`);
    } catch (err: any) {
      console.error("Failed to send customer notification email:", err);
    }
  }
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
    available: boolean;
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

    const admin = createSupabaseAdmin();
    const { data: dbProducts } = await admin
      .from("products")
      .select("id, available");

    const availabilityMap = new Map(dbProducts?.map(p => [p.id, p.available]) || []);

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
        available: availabilityMap.get(node.id) ?? true,
      };
    });

    return { ok: true, products };
  } catch (err: any) {
    console.error("Failed to fetch admin products:", err);
    return { ok: false, error: err.message || "Failed to fetch products from Saleor." };
  }
}

export async function updateSingleProductPrice(
  productId: string,
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
        id: productId,
        slug,
        name,
        price_per_suit: newPrice,
        suit_variant_id: variantId,
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

    await notifyAdminsOfChange(
      "Update Single Price",
      `Product: ${name}\nSlug: ${slug}\nID: ${productId}\nVariant ID: ${variantId}\nNew Price: ${newPrice} PKR`
    );

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
            id: p.id,
            slug: p.slug,
            name: p.name,
            price_per_suit: roundedPrice,
            suit_variant_id: p.variantId,
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
    
    await notifyAdminsOfChange(
      "Bulk Price Shift",
      `Type: ${type}\nAmount: ${amount}\nDirection: ${direction}\nErrors: ${errors.length > 0 ? errors.join("; ") : "None"}`
    );

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

export async function addProductColor(
  productId: string,
  colorName: string,
  stock: number = 0,
  applyToAll: boolean = false,
  productName?: string,
  productSlug?: string,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const normalized = colorName.trim().toUpperCase();
  if (!normalized) return { ok: false, error: "Color name is required." };

  const admin = createSupabaseAdmin();

  try {
    // 1. Auto-sync product details to Supabase products table first to guarantee NO FK violations!
    if (!applyToAll) {
      const saleorProducts = await getProducts();
      const match = saleorProducts.find((p) => p.id === productId);
      if (match) {
        const { error: prodErr } = await admin.from("products").upsert({
          id: match.id,
          slug: match.slug,
          name: match.name,
          price_per_suit: match.pricePerSuit,
          price_per_meter: match.pricePerMeter,
          category: match.category,
          weave: match.weave,
          gsm: match.gsm,
          thread_count: match.threadCount || null,
          composition: match.composition,
          color_name: match.colorName,
          color_hex: match.colorHex,
          meters_per_suit: match.metersPerSuit,
          images: match.images,
          short_description: match.shortDescription,
          description: match.description,
          is_new: match.isNew || false,
          is_featured: match.isFeatured || false,
          available: match.available,
          suit_variant_id: match.suitVariantId || null,
          meter_variant_id: match.meterVariantId || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

        if (prodErr) {
          console.warn("Auto product sync in addProductColor failed:", prodErr.message);
        }
      }
    } else {
      // If applyToAll, sync ALL products to Supabase first!
      const saleorProducts = await getProducts();
      if (saleorProducts && saleorProducts.length) {
        const { error: prodErr } = await admin.from("products").upsert(
          saleorProducts.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            price_per_suit: p.pricePerSuit,
            price_per_meter: p.pricePerMeter,
            category: p.category,
            weave: p.weave,
            gsm: p.gsm,
            thread_count: p.threadCount || null,
            composition: p.composition,
            color_name: p.colorName,
            color_hex: p.colorHex,
            meters_per_suit: p.metersPerSuit,
            images: p.images,
            short_description: p.shortDescription,
            description: p.description,
            is_new: p.isNew || false,
            is_featured: p.isFeatured || false,
            available: p.available,
            suit_variant_id: p.suitVariantId || null,
            meter_variant_id: p.meterVariantId || null,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "id" }
        );

        if (prodErr) {
          console.warn("Auto bulk product sync in addProductColor failed:", prodErr.message);
        }
      }
    }

    if (applyToAll) {
      // Fetch all products from Saleor (source of truth — no FK dependency)
      const saleorProducts = await getAdminProducts();
      if (!saleorProducts.ok || !saleorProducts.products?.length) {
        return { ok: false, error: "No products found in Saleor to apply color to." };
      }

      const inserts = saleorProducts.products.map((p) => ({
        product_id: p.id,
        color_name: normalized,
        stock,
      }));

      const { error: insErr } = await admin
        .from("product_colors")
        .upsert(inserts, { onConflict: "product_id,color_name", ignoreDuplicates: true });

      if (insErr) return { ok: false, error: insErr.message };
    } else {
      const { error: insErr } = await admin
        .from("product_colors")
        .upsert(
          { product_id: productId, color_name: normalized, stock },
          { onConflict: "product_id,color_name", ignoreDuplicates: true },
        );

      if (insErr) return { ok: false, error: insErr.message };
    }

    revalidatePath("/admin/stock");
    revalidatePath("/admin/pricing");

    await notifyAdminsOfChange(
      "Add Color Variety",
      `Product ID: ${productId}\nColor: ${normalized}\nStock: ${stock}\nBulk Apply to All: ${applyToAll}`
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "An unexpected error occurred." };
  }
}

export async function uploadProductColorImage(
  productId: string,
  colorName: string,
  formData: FormData,
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  const file = formData.get("file") as File;
  if (!file) return { ok: false, error: "No file uploaded." };

  const normalized = colorName.trim().toUpperCase();
  const admin = createSupabaseAdmin();

  try {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    const fileExt = file.name.split(".").pop() || "jpg";
    const filename = `${productId}_${normalized.replace(/\s+/g, "_")}_${Date.now()}.${fileExt}`;
    const filePath = `variants/${filename}`;

    const { error: uploadErr } = await admin.storage
      .from("product-images")
      .upload(filePath, bytes, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) return { ok: false, error: uploadErr.message };

    const { data: { publicUrl } } = admin.storage
      .from("product-images")
      .getPublicUrl(filePath);

    const { error: updateErr } = await admin
      .from("product_colors")
      .update({ image_url: publicUrl })
      .eq("product_id", productId)
      .eq("color_name", normalized);

    if (updateErr) return { ok: false, error: updateErr.message };

    revalidatePath(`/product/${productId}`);
    revalidatePath("/admin/stock");
    revalidatePath("/admin/pricing");

    await notifyAdminsOfChange(
      "Upload Color Image",
      `Product ID: ${productId}\nColor: ${normalized}\nImage URL: ${publicUrl}`
    );

    return { ok: true, url: publicUrl };
  } catch (err: any) {
    console.error("Error in uploadProductColorImage:", err);
    return { ok: false, error: err.message || "Upload failed." };
  }
}

export async function updateProductColorStock(
  productId: string,
  colorName: string,
  stock: number,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  if (stock < 0) return { ok: false, error: "Stock cannot be negative." };

  const normalized = colorName.trim().toUpperCase();
  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("product_colors")
    .update({ stock })
    .eq("product_id", productId)
    .eq("color_name", normalized);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/stock");

  await notifyAdminsOfChange(
    "Update Color Stock",
    `Product ID: ${productId}\nColor: ${normalized}\nNew Stock: ${stock}`
  );

  return { ok: true };
}

export async function getProductColorsForAdmin(): Promise<{
  ok: boolean;
  productColors?: Array<{
    id: string;
    product_id: string;
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
    .select("id, product_id, color_name, image_url, stock")
    .order("color_name", { ascending: true });

  if (error) return { ok: false, error: error.message };

  const formatted = (data || []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    color_name: item.color_name,
    image_url: item.image_url,
    stock: item.stock,
    product_name: "Unknown Product",
  }));

  return { ok: true, productColors: formatted };
}

export async function getProductColors(productId: string): Promise<{
  ok: boolean;
  colors?: Array<{
    id: string;
    product_id: string;
    color_name: string;
    image_url: string | null;
    stock: number;
  }>;
  error?: string;
}> {
  const admin = createSupabaseAdmin();
  const { data, error } = await admin
    .from("product_colors")
    .select("id, product_id, color_name, image_url, stock")
    .eq("product_id", productId)
    .order("color_name", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, colors: data || [] };
}

export async function syncProductsToSupabase(): Promise<
  { ok: true; synced: number } | { ok: false; error: string }
> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error || "Not an admin." };

  try {
    const saleorProducts = await getProducts();
    if (!saleorProducts || !saleorProducts.length) {
      return { ok: false, error: "No products found in Saleor." };
    }

    const admin = createSupabaseAdmin();
    const { error } = await admin.from("products").upsert(
      saleorProducts.map((p) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        price_per_suit: p.pricePerSuit,
        price_per_meter: p.pricePerMeter,
        category: p.category,
        weave: p.weave,
        gsm: p.gsm,
        thread_count: p.threadCount || null,
        composition: p.composition,
        color_name: p.colorName,
        color_hex: p.colorHex,
        meters_per_suit: p.metersPerSuit,
        images: p.images,
        short_description: p.shortDescription,
        description: p.description,
        is_new: p.isNew || false,
        is_featured: p.isFeatured || false,
        available: p.available,
        suit_variant_id: p.suitVariantId || null,
        meter_variant_id: p.meterVariantId || null,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "id" },
    );

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/pricing");
    revalidatePath("/admin/stock");
    revalidatePath("/shop");

    await notifyAdminsOfChange(
      "Sync Catalog from Saleor",
      `Total products synced: ${saleorProducts.length}`
    );

    return { ok: true, synced: saleorProducts.length };
  } catch (err: any) {
    return { ok: false, error: err.message || "Sync failed." };
  }
}
export async function toggleProductVisibility(
  productId: string,
  visible: boolean,
): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  try {
    // 1. If Saleor is configured, update in Saleor
    if (isSaleorConfigured()) {
      const channelId = await getChannelId();
      await saleorFetch(`
        mutation UpdateProductChannelListing($id: ID!, $input: ProductChannelListingUpdateInput!) {
          productChannelListingUpdate(id: $id, input: $input) {
            errors {
              field
              message
            }
          }
        }
      `, {
        id: productId,
        input: {
          updateChannels: [
            {
              channelId,
              isPublished: visible,
              visibleInListings: visible,
            },
          ],
        },
      });
    }

    // 2. Update in Supabase
    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("products")
      .update({ available: visible })
      .eq("id", productId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/stock");
    revalidatePath("/shop");
    
    await notifyAdminsOfChange(
      "Toggle Product Visibility",
      `Product ID: ${productId}\nVisible: ${visible}`
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to toggle visibility." };
  }
}

export async function adminCreateProduct(
  name: string,
  slug: string,
  categoryKey: string,
  pricePerSuit: number,
  composition: string,
  description: string,
): Promise<{ ok: boolean; productId?: string; error?: string }> {
  const auth = await requireAdmin();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const admin = createSupabaseAdmin();
    let productId = "p-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    let variantId = "";
    const sku = `${slug}-suit`;

    // 1. If Saleor is configured, create in Saleor first to get the real IDs
    if (isSaleorConfigured()) {
      // A. Get Product Type "Fabric"
      const typeRes = await saleorFetch<{ productTypes: { edges: Array<{ node: { id: string; name: string } }> } }>(`
        query GetProductTypes {
          productTypes(first: 10) {
            edges {
              node {
                id
                name
              }
            }
          }
        }
      `, {});
      const fabricType = typeRes.productTypes?.edges?.find(e => e.node.name.toLowerCase() === "fabric")?.node?.id;
      if (!fabricType) return { ok: false, error: "Product type 'Fabric' not found in Saleor." };

      // B. Get Category ID
      const catRes = await saleorFetch<{ categories: { edges: Array<{ node: { id: string; name: string; slug: string } }> } }>(`
        query GetCategories {
          categories(first: 20) {
            edges {
              node {
                id
                name
                slug
              }
            }
          }
        }
      `, {});
      const categoryId = catRes.categories?.edges?.find(e => e.node.slug === categoryKey)?.node?.id;
      if (!categoryId) return { ok: false, error: `Category '${categoryKey}' not found in Saleor.` };

      // C. Create Product
      const prodRes = await saleorFetch<{ productCreate: { product: { id: string } | null; errors: Array<{ message: string }> } }>(`
        mutation CreateProduct($input: ProductCreateInput!) {
          productCreate(input: $input) {
            product {
              id
            }
            errors {
              field
              message
            }
          }
        }
      `, {
        input: {
          name,
          slug,
          productType: fabricType,
          category: categoryId,
          description: JSON.stringify({
            blocks: [{ type: "paragraph", data: { text: `${description} Composition: ${composition}.` } }]
          })
        }
      });
      if (prodRes.productCreate?.errors?.length) {
        return { ok: false, error: `Saleor Product Create Error: ${prodRes.productCreate.errors[0].message}` };
      }
      productId = prodRes.productCreate.product!.id;

      // D. Publish Product (Channel Listing)
      const channelId = await getChannelId();
      await saleorFetch(`
        mutation PublishProduct($id: ID!, $input: ProductChannelListingUpdateInput!) {
          productChannelListingUpdate(id: $id, input: $input) {
            errors {
              field
              message
            }
          }
        }
      `, {
        id: productId,
        input: {
          updateChannels: [
            {
              channelId,
              isPublished: true,
              visibleInListings: true
            }
          ]
        }
      });

      // E. Create Suit Variant
      const varRes = await saleorFetch<{ productVariantCreate: { productVariant: { id: string } | null; errors: Array<{ message: string }> } }>(`
        mutation CreateVariant($input: ProductVariantCreateInput!) {
          productVariantCreate(input: $input) {
            productVariant {
              id
            }
            errors {
              field
              message
            }
          }
        }
      `, {
        input: {
          product: productId,
          sku,
          name: "By the Suit",
          trackInventory: false
        }
      });
      if (varRes.productVariantCreate?.errors?.length) {
        return { ok: false, error: `Saleor Variant Create Error: ${varRes.productVariantCreate.errors[0].message}` };
      }
      variantId = varRes.productVariantCreate.productVariant!.id;

      // F. Set Variant Price
      await saleorFetch(`
        mutation UpdateVariantPrice($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
          productVariantChannelListingUpdate(id: $id, input: $input) {
            errors {
              field
              message
            }
          }
        }
      `, {
        id: variantId,
        input: [
          {
            channelId,
            price: pricePerSuit
          }
        ]
      });
    }

    // 2. Save in Supabase
    const { error: prodErr } = await admin.from("products").insert({
      id: productId,
      slug,
      name,
      price_per_suit: pricePerSuit,
      category: categoryKey,
      composition,
      description,
      short_description: description.length > 120 ? description.slice(0, 117) + "..." : description,
      available: true,
      suit_variant_id: variantId || null,
      sku: sku,
      updated_at: new Date().toISOString(),
    });

    if (prodErr) return { ok: false, error: prodErr.message };

    revalidatePath("/admin/stock");
    revalidatePath("/admin/pricing");
    revalidatePath("/shop");

    await notifyAdminsOfChange(
      "Create New Product",
      `Product: ${name}\nSlug: ${slug}\nCategory: ${categoryKey}\nPrice: ${pricePerSuit} PKR\nSaleor ID: ${productId}`
    );

    return { ok: true, productId };
  } catch (err: any) {
    return { ok: false, error: err.message || "An unexpected error occurred during product creation." };
  }
}

export async function adminDeleteProduct(productId: string): Promise<AdminResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  try {
    // 1. If Saleor is configured, delete in Saleor
    if (isSaleorConfigured()) {
      await saleorFetch(`
        mutation DeleteProduct($id: ID!) {
          productDelete(id: $id) {
            errors {
              field
              message
            }
          }
        }
      `, { id: productId });
    }

    // 2. Delete from Supabase (cascades colors automatically)
    const admin = createSupabaseAdmin();
    const { error } = await admin
      .from("products")
      .delete()
      .eq("id", productId);

    if (error) return { ok: false, error: error.message };

    revalidatePath("/admin/stock");
    revalidatePath("/admin/pricing");
    revalidatePath("/shop");

    await notifyAdminsOfChange(
      "Delete Product",
      `Product ID: ${productId} has been permanently deleted from both Saleor and Supabase.`
    );

    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to delete product." };
  }
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
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: `"BerkePak Fabrics" <${smtpUser}>`,
        to: "admin@berkepakfabrics.com, abdullahahmad@berkepakfabrics.com",
        subject: `⚠️ Admin Action Alert: ${actionName}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #fafaf9; color: #1c1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e7e5e4;">
              <h2 style="font-size: 20px; font-weight: 700; color: #b91c1c; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f5f5f4; padding-bottom: 10px;">
                Admin Action Logged
              </h2>
              <p style="font-size: 14px; margin-bottom: 12px;"><strong>Action:</strong> ${actionName}</p>
              <p style="font-size: 14px; margin-bottom: 12px;"><strong>Timestamp:</strong> ${new Date().toLocaleString()}</p>
              <div style="background-color: #f5f5f4; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 13px; white-space: pre-wrap; margin-top: 15px; border-left: 4px solid #b91c1c;">
                ${details}
              </div>
              <p style="font-size: 12px; color: #78716c; margin-top: 25px; text-align: center; border-top: 1px solid #f5f5f4; padding-top: 15px;">
                This is an automated administrative notification from BerkePak Fabrics.
              </p>
            </div>
          </div>
        `,
      });
    } catch (err: any) {
      console.error("Failed to send admin notification email:", err);
    }
  }
}
