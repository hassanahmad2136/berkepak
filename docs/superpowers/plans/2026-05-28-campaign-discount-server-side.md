# Campaign Discount Server-Side & Cart Price Expiry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply campaign discounts server-side in `placeOrder()`, add `updatePriceOverride` to cart store, and re-validate cart line prices against active campaigns every time the cart drawer opens.

**Architecture:** Three sequential tasks. Task 1 fixes server-side order totals (single file). Task 2 adds a cart store action (single file). Task 3 wires CartDrawer to re-validate campaign prices on open using that new action. No schema changes.

**Tech Stack:** Next.js App Router server actions, Zustand persist, Supabase anon client (`getActiveCampaigns` callable client-side via `NEXT_PUBLIC_*` env vars).

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `web/src/lib/actions/orders.ts` | Import campaign helpers; compute per-line discount; max-wins vs coupon |
| Modify | `web/src/lib/cart-store.ts` | Add `updatePriceOverride` action |
| Modify | `web/src/components/CartDrawer.tsx` | Re-validate campaign prices on cart open |

---

### Task 1: Server-side campaign discount in `placeOrder()`

**Files:**
- Modify: `web/src/lib/actions/orders.ts`

#### Background for the implementer

`placeOrder()` currently computes server-side totals using raw `product.pricePerSuit` (line ~64). Coupon discounts are validated server-side (lines ~91–116), but automatic campaign discounts are not. This task fixes that. The computation model:

```
originalSubtotal = sum(product.pricePerSuit × qty)   ← stored in orders.subtotal
subtotal         = sum(discountedUnitPrice × qty)     ← used for campaignDiscount
campaignDiscount = originalSubtotal - subtotal
couponDiscount   = validated against originalSubtotal
discountAmount   = max(campaignDiscount, couponDiscount)
total            = max(0, originalSubtotal + shipping - discountAmount)
```

`orders.subtotal` stores the original (pre-campaign) price — consistent with existing coupon flow.
`order_items.unit_price` and `order_items.line_total` store discounted prices for receipts.
`orders.discount_amount` stores the winning discount (campaign or coupon).
`orders.promo_id` is null when campaign wins.

- [ ] **Step 1: Read the current file**

Read `web/src/lib/actions/orders.ts` in full. Identify:
- Line ~9: existing imports block
- Line ~60: `Promise.all` that maps lines to items (`const items = await Promise.all(...)`)
- Line ~64: `const unitPrice = product.pricePerSuit;`
- Line ~87: `const subtotal = items.reduce(...)`
- Line ~88: `const shipping = subtotal >= 10_000 ? 0 : 350;`
- Lines ~91–116: coupon validation block ending with `const total = Math.max(...)`

- [ ] **Step 2: Add campaign imports**

Find the existing import block at the top. It currently includes:
```ts
import { getProductByIdAsync } from "@/lib/products";
import { sendOrderConfirmationEmail } from "@/lib/actions/email-actions";
```

Add one more import after `getProductByIdAsync`:
```ts
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
```

- [ ] **Step 3: Fetch campaigns before the items loop**

Find the line just before the `Promise.all` that builds `items`. It looks like:
```ts
  // Recompute totals server-side so the client cannot tamper with prices.
  const items = await Promise.all(validInput.lines.map(async (line) => {
```

Insert the campaign fetch immediately before it:
```ts
  // Fetch active campaigns once — used for per-line discount computation.
  const campaigns = await getActiveCampaigns();

  // Recompute totals server-side so the client cannot tamper with prices.
  const items = await Promise.all(validInput.lines.map(async (line) => {
```

- [ ] **Step 4: Apply per-line campaign discount inside the items map**

Find the current unit price calculation inside the `Promise.all` callback:
```ts
    const unitPrice = product.pricePerSuit;
    const stitchingAddon =
      line.stitching === "bespoke"
        ? BESPOKE_STITCHING_ADDON_PKR
        : 0;
    const lineTotal = (unitPrice + stitchingAddon) * line.quantity;
```

Replace with:
```ts
    const campaign = getCampaignForProduct(product.id, product.category, campaigns);
    const campaignDisc = campaign
      ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)
      : null;
    const unitPrice = campaignDisc?.discountedPricePerSuit ?? product.pricePerSuit;
    const stitchingAddon =
      line.stitching === "bespoke"
        ? BESPOKE_STITCHING_ADDON_PKR
        : 0;
    const originalLineTotal = (product.pricePerSuit + stitchingAddon) * line.quantity;
    const lineTotal = (unitPrice + stitchingAddon) * line.quantity;
```

- [ ] **Step 5: Return `originalLineTotal` from the items map**

Find the `return` object inside the `Promise.all` callback. It currently ends with:
```ts
      line_total: lineTotal,
      color,
    };
```

Replace with:
```ts
      line_total: lineTotal,
      original_line_total: originalLineTotal,
      color,
    };
```

- [ ] **Step 6: Replace the subtotal + shipping + coupon + total block**

Find this existing block (right after the `items` array is built):
```ts
  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const shipping = subtotal >= 10_000 ? 0 : 350;

  // Re-validate promo server-side (never trust client discount amount)
  let discountAmount = 0;
  let validatedPromoId: string | null = null;
  if (validInput.promoId) {
    const adminForPromo = createSupabaseAdmin();
    const { data: promo } = await adminForPromo
      .from("promotions")
      .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
      .eq("id", validInput.promoId)
      .eq("type", "coupon")
      .eq("is_active", true)
      .maybeSingle();
    if (promo) {
      const now = new Date();
      const validDates =
        (!promo.starts_at || new Date(promo.starts_at) <= now) &&
        (!promo.ends_at || new Date(promo.ends_at) >= now);
      const validMin = subtotal >= Number(promo.min_order_amount ?? 0);
      if (validDates && validMin) {
        discountAmount =
          promo.discount_type === "pct"
            ? Math.floor(subtotal * (Number(promo.discount_value) / 100))
            : Math.min(Number(promo.discount_value), subtotal);
        validatedPromoId = promo.id;
      }
    }
  }

  const total = Math.max(0, subtotal + shipping - discountAmount);
```

Replace with:
```ts
  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const originalSubtotal = items.reduce((sum, it) => sum + it.original_line_total, 0);
  // Shipping threshold based on original (pre-discount) subtotal.
  const shipping = originalSubtotal >= 10_000 ? 0 : 350;

  // Campaign discount = difference between original and discounted line totals.
  const campaignDiscount = originalSubtotal - subtotal;

  // Re-validate coupon server-side against originalSubtotal (never trust client).
  let couponDiscount = 0;
  let validatedPromoId: string | null = null;
  if (validInput.promoId) {
    const adminForPromo = createSupabaseAdmin();
    const { data: promo } = await adminForPromo
      .from("promotions")
      .select("id, discount_type, discount_value, min_order_amount, is_active, starts_at, ends_at")
      .eq("id", validInput.promoId)
      .eq("type", "coupon")
      .eq("is_active", true)
      .maybeSingle();
    if (promo) {
      const now = new Date();
      const validDates =
        (!promo.starts_at || new Date(promo.starts_at) <= now) &&
        (!promo.ends_at || new Date(promo.ends_at) >= now);
      const validMin = originalSubtotal >= Number(promo.min_order_amount ?? 0);
      if (validDates && validMin) {
        couponDiscount =
          promo.discount_type === "pct"
            ? Math.floor(originalSubtotal * (Number(promo.discount_value) / 100))
            : Math.min(Number(promo.discount_value), originalSubtotal);
        validatedPromoId = promo.id;
      }
    }
  }

  // Larger discount wins — campaign and coupon do not stack.
  const discountAmount = Math.max(campaignDiscount, couponDiscount);
  // Store promo_id only when coupon wins; null signals automatic campaign discount.
  const storedPromoId = couponDiscount >= campaignDiscount ? validatedPromoId : null;

  const total = Math.max(0, originalSubtotal + shipping - discountAmount);
```

- [ ] **Step 7: Update the `orders` insert to use `originalSubtotal` and `storedPromoId`**

Find the orders insert block. It currently uses `subtotal` and `validatedPromoId`:
```ts
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: validInput.paymentMethod,
    payment_status:
      validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal,
    shipping,
    discount_amount: discountAmount,
    promo_id: validatedPromoId,
    total,
    shipping_address: validInput.address,
    otp_verified: validInput.otpVerified,
  });
```

Replace with:
```ts
  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: validInput.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: validInput.paymentMethod,
    payment_status:
      validInput.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal: originalSubtotal,
    shipping,
    discount_amount: discountAmount,
    promo_id: storedPromoId,
    total,
    shipping_address: validInput.address,
    otp_verified: validInput.otpVerified,
  });
```

- [ ] **Step 8: Strip `original_line_total` when inserting order_items**

Find the `order_items` insert block. It maps `items` to DB rows. The `original_line_total` field must NOT be inserted (it doesn't exist as a DB column). Find this part of the map:

```ts
    .insert(items.map((it) => ({
      order_id: orderId,
      product_id: it.product_id,
      product_name: it.product_name,
      product_slug: it.product_slug,
      unit: it.unit,
      quantity: it.quantity,
      unit_price: it.unit_price,
      stitching: it.stitching,
      stitching_addon: it.stitching_addon,
      line_total: it.line_total,
      color: it.color,
    })));
```

This is already correct — `original_line_total` is not listed here. Verify it is absent. If it's present, remove it.

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/actions/orders.ts
git commit -m "feat(orders): apply campaign discount server-side with max-wins vs coupon"
```

---

### Task 2: Add `updatePriceOverride` to cart store

**Files:**
- Modify: `web/src/lib/cart-store.ts`

#### Background for the implementer

The cart store (`cart-store.ts`) uses Zustand with persist. `CartLine` has `unitPriceOverride?: number` (already added). We need an action to update or clear this field for a specific line — used by `CartDrawer` when re-validating campaign prices.

- [ ] **Step 1: Read the current file**

Read `web/src/lib/cart-store.ts`. Identify:
- The `CartState` interface (lines ~14–42) with all action signatures
- The `useCart` create/persist block where actions are implemented

- [ ] **Step 2: Add `updatePriceOverride` to the `CartState` interface**

Find the end of the `CartState` interface. It currently ends with:
```ts
  clear: () => void;
}
```

Replace with:
```ts
  clear: () => void;
  updatePriceOverride: (
    productId: string,
    unit: SaleUnit,
    stitching: Stitching,
    color: string,
    price: number | undefined,
  ) => void;
}
```

- [ ] **Step 3: Add the implementation inside `useCart`**

Find the `clear` implementation inside the `create` block:
```ts
      clear: () => set({ lines: [] }),
```

Add `updatePriceOverride` immediately after it (before the closing `},` of the create callback):
```ts
      clear: () => set({ lines: [] }),
      updatePriceOverride: (productId, unit, stitching, color, price) =>
        set((s) => ({
          lines: s.lines.map((l) =>
            l.productId === productId &&
            l.unit === unit &&
            l.stitching === stitching &&
            (l.color || "White") === color
              ? { ...l, unitPriceOverride: price }
              : l,
          ),
        })),
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors).

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/cart-store.ts
git commit -m "feat(cart): add updatePriceOverride action to cart store"
```

---

### Task 3: Re-validate campaign prices when cart opens

**Files:**
- Modify: `web/src/components/CartDrawer.tsx`

#### Background for the implementer

`CartDrawer` is a client component (`"use client"`). `getActiveCampaigns()` in `web/src/lib/campaigns.ts` uses only `NEXT_PUBLIC_*` Supabase env vars — safe to call from client-side code. This task adds a `useEffect` that fires when `isOpen` becomes `true` AND products are loaded. It re-fetches active campaigns, computes fresh per-line discounts, and calls `updatePriceOverride` to update or clear stale overrides. This means:

- Campaign still active → `unitPriceOverride` updated to current discounted price
- Campaign expired or no campaign → `unitPriceOverride` cleared (`undefined`) → `lineSubtotal` falls back to live product price automatically

- [ ] **Step 1: Read the current file**

Read `web/src/components/CartDrawer.tsx` in full. Note:
- Line ~5: existing import from `@/lib/cart-store` (`useCart`, `cartSubtotal`, `lineSubtotal`)
- Line ~13: `const { isOpen, close, lines, setQuantity, remove } = useCart();`
- The second `useEffect` (lines ~22–33) that fetches products into `productMap`

- [ ] **Step 2: Add campaign helper imports**

Find the existing imports at the top of the file:
```ts
import { useCart, cartSubtotal, lineSubtotal } from "@/lib/cart-store";
import { getProductByIdAsync } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
```

Replace with:
```ts
import { useCart, cartSubtotal, lineSubtotal } from "@/lib/cart-store";
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
import { getProductByIdAsync } from "@/lib/products";
import { formatPKR } from "@/lib/format";
import { useEffect, useState } from "react";
import type { Product } from "@/lib/types";
```

- [ ] **Step 3: Destructure `updatePriceOverride` from `useCart`**

Find the existing destructure line:
```ts
  const { isOpen, close, lines, setQuantity, remove } = useCart();
```

Replace with:
```ts
  const { isOpen, close, lines, setQuantity, remove, updatePriceOverride } = useCart();
```

- [ ] **Step 4: Add campaign re-validation effect**

Find the second `useEffect` (the one that fetches products). It starts with:
```ts
  useEffect(() => {
    if (lines.length === 0) return;
    const ids = [...new Set(lines.map((l) => l.productId))];
```

Add the campaign re-validation effect immediately AFTER the closing `}, [lines]);` of that product-fetch effect:

```ts
  // Re-validate campaign discounts every time the cart opens.
  // Clears stale unitPriceOverride when campaigns expire; updates when they change.
  useEffect(() => {
    if (!isOpen || lines.length === 0) return;
    // Wait until products are loaded into productMap
    const allLoaded = lines.every((l) => productMap.has(l.productId));
    if (!allLoaded) return;

    getActiveCampaigns().then((campaigns) => {
      lines.forEach((line) => {
        const product = productMap.get(line.productId);
        if (!product) return;
        const campaign = getCampaignForProduct(product.id, product.category, campaigns);
        const discount = campaign
          ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)
          : null;
        const freshPrice = discount?.discountedPricePerSuit;
        // Only write if value changed to avoid unnecessary re-renders
        if (freshPrice !== line.unitPriceOverride) {
          updatePriceOverride(
            line.productId,
            line.unit,
            line.stitching,
            line.color || "White",
            freshPrice,
          );
        }
      });
    });
  }, [isOpen, productMap]);
```

**Note:** `lines` is intentionally excluded from the dependency array. The effect runs when `isOpen` changes or `productMap` changes (products finish loading). Adding `lines` would cause an infinite loop: `updatePriceOverride` → lines change → effect runs → `updatePriceOverride` → ...

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/abdullah/code/BerkePak/web && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output (zero errors). If there is a TypeScript error about `lines` in the effect body but not in deps, add `// eslint-disable-next-line react-hooks/exhaustive-deps` above the dependency array — the omission is intentional.

- [ ] **Step 6: Manual smoke test**

1. Start dev server: `cd web && npm run dev`
2. Create an active campaign in `/admin/campaigns` (e.g. 20% off all products)
3. Add a product to cart — verify "Add to Cart — PKR X" shows discounted price
4. Open cart drawer — verify discounted line price and subtotal
5. In admin, deactivate the campaign
6. Close and reopen cart drawer — verify price reverts to original
7. Re-activate campaign — reopen cart — verify discount reappears

- [ ] **Step 7: Commit**

```bash
git add web/src/components/CartDrawer.tsx
git commit -m "feat(cart): re-validate campaign prices on cart open, clear expired discounts"
```

---

## Self-Review

**Spec coverage:**
- ✅ Import campaign helpers in `orders.ts` → Task 1 Step 2
- ✅ Fetch campaigns before item loop → Task 1 Step 3
- ✅ Per-line discounted unit price → Task 1 Step 4
- ✅ `originalLineTotal` computed locally → Task 1 Step 5
- ✅ `campaignDiscount = originalSubtotal - subtotal` → Task 1 Step 6
- ✅ Coupon validated against `originalSubtotal` → Task 1 Step 6
- ✅ Max-wins logic → Task 1 Step 6
- ✅ `storedPromoId` null when campaign wins → Task 1 Step 6
- ✅ `orders.subtotal` = `originalSubtotal` → Task 1 Step 7
- ✅ `original_line_total` NOT inserted to DB → Task 1 Step 8
- ✅ `updatePriceOverride` in CartState interface → Task 2 Step 2
- ✅ `updatePriceOverride` implementation → Task 2 Step 3
- ✅ Campaign imports in CartDrawer → Task 3 Step 2
- ✅ `updatePriceOverride` destructured → Task 3 Step 3
- ✅ Campaign re-validation effect on open → Task 3 Step 4
- ✅ Expired campaign clears override → Task 3 Step 4 (`freshPrice = undefined`)
- ✅ Changed campaign updates override → Task 3 Step 4 (updates if `freshPrice !== line.unitPriceOverride`)

**Placeholder scan:** None found.

**Type consistency:**
- `updatePriceOverride(productId: string, unit: SaleUnit, stitching: Stitching, color: string, price: number | undefined)` — defined in Task 2, called with same signature in Task 3 ✅
- `getActiveCampaigns()` returns `Campaign[]` — used in `getCampaignForProduct(product.id, product.category, campaigns)` — matches signature in `campaigns.ts` ✅
- `computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)` returns `ProductDiscount` with `.discountedPricePerSuit` — correct ✅
- `campaignDisc` (Task 1) vs `discount` (Task 3) — different variable names for the same type, but in different scopes ✅
