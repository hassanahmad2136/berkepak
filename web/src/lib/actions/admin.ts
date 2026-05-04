"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";

export type AdminResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: true } | AdminResult> {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "Not signed in." };
  if (!isAdminEmail(data.user.email)) return { ok: false, error: "Not an admin." };
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
