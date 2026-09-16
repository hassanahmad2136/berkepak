"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/guards";
import { query, queryOne } from "@/lib/db";
import { putObject } from "@/lib/storage";

export type UploadReceiptResult = { ok: true } | { ok: false; error: string };

const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

/** Bank references vary by bank; this admits them and little else. */
const TRANSACTION_ID_RE = /^[A-Z0-9-]{6,40}$/;

const ALREADY_CLAIMED =
  "This transaction ID has already been submitted for an order. If that is a mistake, contact us on WhatsApp.";

/**
 * Attaches a bank-transfer receipt — the bank's transaction ID plus a
 * screenshot — to an order.
 *
 * Two callers: a signed-in customer (matched on user_id) and a guest, who
 * proves ownership with the token issued when the order was placed. Without
 * the guest path a guest paying by bank transfer could never complete payment.
 *
 * The transaction ID is what makes review possible: a screenshot is easy to
 * reuse or edit, but an ID can be matched against the bank statement, and it
 * can only be claimed by one live receipt.
 */
export async function uploadReceipt(formData: FormData): Promise<UploadReceiptResult> {
  const orderId = String(formData.get("orderId") ?? "").trim();
  const guestToken = String(formData.get("guestToken") ?? "").trim();
  const transactionId = String(formData.get("transactionId") ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const file = formData.get("file");

  if (!orderId) return { ok: false, error: "Order ID is required." };
  if (!TRANSACTION_ID_RE.test(transactionId)) {
    return {
      ok: false,
      error: "Enter the transaction ID from your bank app — 6 to 40 letters or numbers.",
    };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Please choose a screenshot of the transfer." };
  }
  if (file.size > 10 * 1024 * 1024) {
    return { ok: false, error: "File must be under 10 MB." };
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: "Only JPEG, PNG, WebP, HEIC, or PDF files are accepted." };
  }

  const user = await getCurrentUser();

  // The order must belong to this caller — by session, or by guest token.
  // These predicates are the only thing stopping a receipt being attached to
  // somebody else's order.
  type OwnedOrder = { id: string; payment_method: string; payment_status: string };
  const order = user
    ? await queryOne<OwnedOrder>(
        `select id, payment_method, payment_status from orders where id = $1 and user_id = $2`,
        [orderId, user.id],
      )
    : guestToken
      ? await queryOne<OwnedOrder>(
          `select id, payment_method, payment_status from orders
            where id = $1 and guest_token = $2 and user_id is null`,
          [orderId, guestToken],
        )
      : null;

  if (!order) return { ok: false, error: "Order not found." };
  if (order.payment_method !== "bank_transfer") {
    return { ok: false, error: "Receipts only apply to bank-transfer orders." };
  }
  if (order.payment_status === "paid") {
    return { ok: false, error: "This order is already paid." };
  }

  // Checked before the upload so a reused ID costs no storage. The unique
  // index below is what actually guarantees it under concurrency.
  const claimed = await queryOne(
    `select 1 as taken from receipts
      where upper(transaction_id) = $1 and status <> 'rejected'
      limit 1`,
    [transactionId],
  );
  if (claimed) return { ok: false, error: ALREADY_CLAIMED };

  const ext = file.name.split(".").pop() || "bin";
  const key = `${user?.id ?? "guest"}/${orderId}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  try {
    await putObject("receipts", key, bytes, file.type, {
      ownerId: user?.id ?? null,
      isPublic: false,
    });
  } catch (err) {
    console.error("[receipts] upload failed:", err);
    return { ok: false, error: "Upload failed. Please try again." };
  }

  try {
    await query(
      `insert into receipts (order_id, user_id, storage_path, transaction_id)
       values ($1, $2, $3, $4)`,
      [orderId, user?.id ?? null, key, transactionId],
    );
  } catch (err) {
    // 23505: receipts_transaction_id_key — the same ID won a race elsewhere.
    if ((err as { code?: string }).code === "23505") return { ok: false, error: ALREADY_CLAIMED };
    throw err;
  }
  await query(`update orders set payment_status = 'awaiting_review' where id = $1`, [orderId]);

  revalidatePath("/account/receipts");
  revalidatePath("/account/orders");
  return { ok: true };
}
