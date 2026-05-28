# Order Confirmation Email Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix order confirmation emails so COD fires immediately on placement (awaited, non-fatal) and bank transfer fires only when admin approves the receipt.

**Architecture:** Two targeted changes. `placeOrder()` in `orders.ts` gains a payment-method guard and proper `await`. `approveReceipt()` in `admin.ts` gains a post-approval email send that fetches the customer email via the Supabase admin auth API. No schema changes. No new dependencies.

**Tech Stack:** Next.js App Router server actions, nodemailer (via existing `sendEmail`), Supabase admin client (`admin.auth.admin.getUserById`).

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `web/src/lib/actions/orders.ts` | Guard email for COD only; await with try/catch |
| Modify | `web/src/lib/actions/admin.ts` | Import email action; send on receipt approval |

---

### Task 1: Fix `placeOrder()` — await email, skip for bank transfer

**Files:**
- Modify: `web/src/lib/actions/orders.ts` (lines 178–183)

- [ ] **Step 1: Read the file to confirm current state**

Read `web/src/lib/actions/orders.ts`. Confirm lines 178–183 look like:

```ts
// Non-fatal: send confirmation email (order already committed)
if (userData.user.email) {
  sendOrderConfirmationEmail(orderId, userData.user.email).catch((err) =>
    console.error("Order confirmation email failed:", err),
  );
}
```

- [ ] **Step 2: Replace the fire-and-forget block**

Replace those lines with:

```ts
// Send confirmation immediately for COD. Bank transfer waits for admin receipt approval.
if (userData.user.email && validInput.paymentMethod !== "bank_transfer") {
  try {
    await sendOrderConfirmationEmail(orderId, userData.user.email);
  } catch (err) {
    console.error("Order confirmation email failed:", err);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/actions/orders.ts
git commit -m "fix(email): await COD confirmation email, skip for bank transfer"
```

---

### Task 2: Fix `approveReceipt()` — send email on approval

**Files:**
- Modify: `web/src/lib/actions/admin.ts` (top imports + inside `approveReceipt`)

- [ ] **Step 1: Read the file to confirm current imports and `approveReceipt` shape**

Read `web/src/lib/actions/admin.ts`. Confirm:
- Top imports block (lines 1–7) does NOT yet import `sendOrderConfirmationEmail`
- `approveReceipt()` ends around line 48 with `return { ok: true };` after `revalidatePath` calls, with no email call

- [ ] **Step 2: Add the import for `sendOrderConfirmationEmail`**

Find the existing import block at the top of the file:

```ts
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import nodemailer from "nodemailer";
```

Replace with:

```ts
import { revalidatePath } from "next/cache";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { isCurrentUserAdmin } from "@/lib/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import nodemailer from "nodemailer";
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
```

- [ ] **Step 3: Add email send after receipt approval succeeds**

Find the end of `approveReceipt()`. Current final lines (around lines 44–48):

```ts
  const { error: oErr } = await admin
    .from("orders")
    .update({ payment_status: "paid", status: "confirmed" })
    .eq("id", receipt.order_id);
  if (oErr) return { ok: false, error: oErr.message };

  revalidatePath("/admin/receipts");
  revalidatePath("/admin/orders");
  return { ok: true };
}
```

Replace with:

```ts
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
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/actions/admin.ts
git commit -m "fix(email): send order confirmation on bank transfer receipt approval"
```

---

## Self-Review

**Spec coverage:**
- ✅ COD email awaited, not fire-and-forget → Task 1
- ✅ Bank transfer skipped at placement → Task 1 (payment method guard)
- ✅ Bank transfer email sent on admin approval → Task 2
- ✅ Non-fatal error handling in both locations → Task 1 try/catch, Task 2 try/catch
- ✅ No schema changes → confirmed, only logic changes

**Placeholder scan:** None found. All code blocks complete.

**Type consistency:**
- `sendOrderConfirmationEmail(orderId: string, userEmail: string): Promise<void>` — signature confirmed from `web/src/lib/actions/email-actions.ts`
- `admin.auth.admin.getUserById(userId)` returns `{ data: { user: { email?: string } } }` — standard Supabase admin auth API shape
- `receipt.order_id` — confirmed present in the existing `.select("id, order_id, status")` query in `approveReceipt()`

All consistent. ✅
