# Berke Pak MVP Finalization — Design Spec
Date: 2026-05-28

## Scope
Five targeted changes to finish the MVP before launch. All code in `web/`. No breaking changes to existing auth, checkout, or admin flows.

---

## 1. Apple Auth — Comment Out

**File:** `web/src/components/SocialAuthButtons.tsx`

Comment out the Apple button block (the `<button>` element calling `sign("apple")` and the `<AppleMark />` SVG). The `sign()` function and Apple provider logic stay in the file but are commented so they can be un-commented post-launch. Google auth remains fully active.

No DB or env changes needed.

---

## 2. Promotions System

### 2a. Database

**New table: `promotions`**
```sql
CREATE TABLE promotions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('banner', 'coupon')),
  title       TEXT NOT NULL,
  body        TEXT,
  code        TEXT UNIQUE,           -- NULL for banner-only promos
  discount_type TEXT CHECK (discount_type IN ('pct', 'fixed')),
  discount_value NUMERIC(10, 2),
  min_order_amount NUMERIC(10, 2) DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  starts_at   TIMESTAMPTZ,
  ends_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

**Modified table: `orders`** — add two nullable columns:
- `discount_amount NUMERIC(10, 2) DEFAULT 0`
- `promo_id UUID REFERENCES promotions(id)`

RLS: `promotions` readable by all authenticated users (for coupon validation); writable by admin only.

### 2b. Admin Page

Route: `/admin/promotions` — new admin section listed in `AdminHeader`.

**List view:** Table of all promotions (title, type, code, discount, active toggle, ends_at, delete button).

**Create form (modal):** Fields:
- Title (required)
- Body / description (for banner popup text)
- Type: banner | coupon (radio)
- Code (shown only when type=coupon, must be uppercase alphanumeric)
- Discount type: % off | fixed PKR (shown only when type=coupon or banner with discount)
- Discount value
- Min order amount (optional)
- Active toggle
- Start / end dates (optional)

**Server actions** (in `web/src/lib/actions/admin.ts` or new `admin-promotions.ts`):
- `createPromotion(input)` — validates, inserts, revalidates paths
- `togglePromotion(id, isActive)` — flips `is_active`
- `deletePromotion(id)` — hard delete (admin only)

### 2c. Homepage Popup

**Component:** `web/src/components/PromotionPopup.tsx` (new client component)

Behavior:
- Reads active banner promotions passed as props from the server component
- Shows first active banner promo (ordered by `created_at DESC`)
- Dismissed via `sessionStorage.setItem('promo_dismissed_<id>', '1')` — re-shows after session ends
- Clean modal overlay: promo title, body text, dismiss button
- No sparkles, no animated borders — plain clean card consistent with existing design system

**Data fetch:** `web/src/app/page.tsx` fetches active banner promos server-side and passes to `PromotionPopup`.

### 2d. Checkout Coupon Code Input

In `CheckoutFlow.tsx`, after the address section and before payment method:

- Optional text field "Have a promo code? (optional)"
- "Apply" button calls server action `validateCoupon(code, subtotal)`
- Server action returns `{ ok: true, discountAmount: number, promoId: string }` or `{ ok: false, error: string }`
- Applied discount shows as a line item in the order summary ("Promo code SAVE10: -PKR 500")
- `placeOrder` extended to accept `promoId?: string` and `discountAmount?: number` — server re-validates the code before saving (prevent tampering)
- `total = subtotal + shipping - discountAmount`

**New server action:** `web/src/lib/actions/promotions.ts`
- `validateCoupon(code, subtotal)` — checks promo exists, is_active, type=coupon, dates valid, min_order_amount met
- Used from both checkout UI (optimistic) and `placeOrder` (authoritative re-check)

---

## 3. Fabric Image + Optional Fields

### 3a. Database

**Migration:** Add to `product_catalog`:
```sql
ALTER TABLE product_catalog
  ADD COLUMN thumbnail_url TEXT,
  ADD COLUMN weave_type    TEXT,
  ADD COLUMN thread_count  INTEGER;
```

### 3b. Supabase Storage

Bucket: `product-images` — public bucket (no auth needed to read, admin-only write enforced via RLS on storage).

Upload flow:
1. Client picks file → uploads directly to Supabase Storage via `supabase.storage.from('product-images').upload()`
2. Gets back public URL
3. URL submitted with the rest of the create-product form to the server action

### 3c. Admin UI

In `StockDashboardClient.tsx`, "Add Product" modal gains:

**New fields:**
- **Fabric image** — `<input type="file" accept="image/*">` + preview thumbnail. Upload happens on form submit (or on file pick). Required field for production, optional for now (null allowed).
- **Weave Type** — text input, placeholder "e.g. Plain, Twill, Satin" (optional)
- **Thread Count** — number input, min=1 (optional)

**State:** `addFormImageFile`, `addFormWeaveType`, `addFormThreadCount` added to existing state.

### 3d. Server Action

`adminCreateProduct` extended with 3 new optional params: `thumbnailUrl`, `weaveType`, `threadCount`. These are passed through to the `INSERT` on `product_catalog`.

Zod schema updated accordingly.

---

## 4. Order Confirmation Email

### 4a. Email Sending

**New file:** `web/src/lib/email.ts`

Uses `nodemailer` with SMTP credentials from env:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=user@example.com
SMTP_PASS=secret
EMAIL_FROM="Berke Pak <orders@berkepak.com>"
```

Exports: `sendEmail({ to, subject, html })`

### 4b. Template

**New file:** `web/src/lib/email-templates/order-confirmation.ts`

Exports: `buildOrderConfirmationEmail(order, items)` → returns HTML string.

Content:
- Header: "Order Confirmed — #BPK-XXXXXX"
- Items table: product name, color, stitching, qty, unit price, line total
- Summary: subtotal, shipping (free if ≥ PKR 10,000), discount (if any), **grand total**
- Payment method section:
  - COD: "We'll collect payment on delivery."
  - Bank Transfer: bank account details (hardcoded from env/config), instruction to send receipt via WhatsApp
- Footer: contact info

Plain-text fallback included.

### 4c. Integration Point

In `web/src/lib/actions/orders.ts`, after successful order save (after stock decrement block):

```ts
// Non-fatal — order already committed
sendOrderConfirmationEmail(orderId, userData.user.email!).catch((err) =>
  console.error("Order email failed:", err)
);
```

`sendOrderConfirmationEmail` in `web/src/lib/actions/email-actions.ts`:
- Fetches complete order + items using admin client
- Calls `buildOrderConfirmationEmail`
- Calls `sendEmail`

---

## 5. Card Payment — Disabled Boilerplate

In `CheckoutFlow.tsx`, add a third payment option after bank transfer:

- Label: "Pay with Card"
- Shows "Coming Soon" badge (small pill, gray background)
- Radio input `disabled`, wrapper visually dimmed (`opacity-50 cursor-not-allowed`)
- Comment block above: `// TODO: Wire up Stripe/card processor here. See docs/payment-integration.md`
- `PaymentMethod` type in `lib/types.ts` stays as `"cod" | "bank_transfer"` — "card" is NOT added to the union (it's never selectable)

---

## Implementation Order

1. Apple auth comment-out (2 min, zero risk)
2. Card payment boilerplate (UI only, zero backend)
3. Fabric image + optional fields (DB migration + UI + server action)
4. Order confirmation email (new infra, non-fatal)
5. Promotions system (most complex — DB, admin page, popup, checkout)

---

## Out of Scope

- Real Apple OAuth credentials setup
- Actual card payment processing
- SMS/WhatsApp OTP (already stubbed)
- Abandoned cart emails
