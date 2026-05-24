"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";

export type UploadReceiptResult =
  | { ok: true }
  | { ok: false; error: string };

export async function uploadReceipt(formData: FormData): Promise<UploadReceiptResult> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const file = formData.get("file");

  if (!orderId) return { ok: false, error: "Order ID is required." };
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a file." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "File must be under 10 MB." };
  }
  const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, HEIC, or PDF files are accepted." };
  }

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Please sign in." };

  // Verify the order belongs to this user (RLS will enforce this too, but fail-fast).
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, payment_method")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr) return { ok: false, error: orderErr.message };
  if (!order) return { ok: false, error: "Order not found." };
  if (order.payment_method !== "bank_transfer") {
    return { ok: false, error: "Receipts only apply to bank-transfer orders." };
  }

  const ext = file.name.split(".").pop() || "bin";
  const path = `${userData.user.id}/${orderId}-${Date.now()}.${ext}`;
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(path, file, {
      contentType: ALLOWED_MIME.includes(file.type) ? file.type : "application/octet-stream",
      upsert: false,
    });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const { error: rowErr } = await supabase.from("receipts").insert({
    order_id: orderId,
    user_id: userData.user.id,
    storage_path: path,
  });
  if (rowErr) return { ok: false, error: rowErr.message };

  await supabase
    .from("orders")
    .update({ payment_status: "awaiting_review" })
    .eq("id", orderId);

  revalidatePath("/account/receipts");
  revalidatePath("/account/orders");
  return { ok: true };
}
