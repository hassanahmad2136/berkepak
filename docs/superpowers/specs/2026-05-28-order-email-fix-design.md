# Order Confirmation Email Fix — Design Spec

**Date:** 2026-05-28

## Problem

Three bugs in order confirmation email delivery:

1. **COD email never arrives on Vercel.** `sendOrderConfirmationEmail()` is called without `await` in `placeOrder()`. Vercel kills the serverless execution context the moment the function returns, terminating the floating promise before the email sends.

2. **Bank transfer email sent too early.** `placeOrder()` fires the email for ALL payment methods, including `bank_transfer`. But a bank transfer order is `"unconfirmed"` until admin reviews the receipt — sending "Order Confirmed" at placement is misleading and incorrect.

3. **Bank transfer approval fires no email.** `approveReceipt()` in `admin.ts` updates the order to `status: "confirmed"` and `payment_status: "paid"` but never triggers any email. The customer never learns their payment was approved.

## Solution

**Option A selected:** `await` with try/catch in-line. No new dependencies. Non-fatal on failure.

## Files Changed

| File | Change |
|------|--------|
| `web/src/lib/actions/orders.ts` | Only send email for non-`bank_transfer` orders. `await` with try/catch. |
| `web/src/lib/actions/admin.ts` | After receipt approval, fetch user email via admin auth client, send confirmation email. |

## Behaviour After Fix

| Payment Method | Email Trigger | Trigger Location |
|----------------|--------------|------------------|
| COD | Immediately on order placement | `placeOrder()` |
| Bank Transfer | When admin approves receipt | `approveReceipt()` |

## Implementation Details

### `orders.ts`

Replace the current fire-and-forget block:
```ts
if (userData.user.email) {
  sendOrderConfirmationEmail(orderId, userData.user.email).catch((err) =>
    console.error("Order confirmation email failed:", err),
  );
}
```

With:
```ts
// Send confirmation immediately for COD. Bank transfer waits for admin approval.
if (userData.user.email && validInput.paymentMethod !== "bank_transfer") {
  try {
    await sendOrderConfirmationEmail(orderId, userData.user.email);
  } catch (err) {
    console.error("Order confirmation email failed:", err);
  }
}
```

### `admin.ts` `approveReceipt()`

After the existing order update succeeds, add:
```ts
// Send confirmation email to customer (non-fatal)
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
```

Also add import at top of `admin.ts`:
```ts
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
```

## Error Handling

- Email failures are non-fatal in both locations.
- Order placement (`placeOrder`) and receipt approval (`approveReceipt`) are already committed to DB before email is attempted.
- Failures logged to console only.

## Constraints

- No schema changes required.
- No new dependencies.
- `sendOrderConfirmationEmail` already handles fetching order data and items from Supabase — callers only pass `orderId` and `email`.
