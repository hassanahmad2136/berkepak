# Campaign Discount Server-Side Validation & Cart Price Expiry — Design Spec

**Date:** 2026-05-28

## Problem

`placeOrder()` in `web/src/lib/actions/orders.ts` recomputes totals server-side but always uses `product.pricePerSuit` — it never applies active campaign discounts. Coupon discounts are validated server-side (good), but automatic campaign discounts (no code required) are not. Result: the DB-stored order total and confirmation email show full price even when a campaign was active at checkout.

## Solution

**Approach A selected:** No new DB columns. Compute campaign discount server-side, take `Math.max(campaignDiscount, couponDiscount)` as the final `discount_amount`. Existing schema unchanged.

## Discount Stacking Rule

**Larger wins.** If both a coupon and a campaign apply, only the bigger discount is applied. They do not stack.

## Computation Model

```
originalSubtotal = sum(product.pricePerSuit × quantity) per line   ← stored in orders.subtotal
campaignSubtotal = sum(discountedPricePerSuit × quantity) per line  ← used for campaignDiscount
campaignDiscount = originalSubtotal - campaignSubtotal
couponDiscount   = validate coupon against originalSubtotal
discountAmount   = max(campaignDiscount, couponDiscount)            ← stored in orders.discount_amount
total            = max(0, originalSubtotal + shipping - discountAmount)
```

`promo_id` is stored only if the coupon discount wins (`couponDiscount >= campaignDiscount`). If campaign wins, `promo_id` remains null — admin can infer an automatic campaign was applied.

## Files Changed

| File | Change |
|------|--------|
| `web/src/lib/actions/orders.ts` | Import campaign helpers; fetch campaigns once before item loop; compute per-line discounted price; compute `campaignDiscount`; apply max-wins logic |
| `web/src/lib/cart-store.ts` | Add `updatePriceOverride` action to CartState |
| `web/src/components/CartDrawer.tsx` | On cart open: fetch active campaigns + products, re-validate `unitPriceOverride` per line, clear expired ones |

No migrations. No new columns.

---

## Part 2: Real-Time Cart Price Expiry

### Problem

`unitPriceOverride` is persisted in Zustand's localStorage. A user adds a product during a 20%-off campaign, closes the browser, campaign expires overnight, reopens the site — cart still shows 20% off. Price never resets.

### Coupon expiry (already handled)

Coupon state in `CheckoutFlow` is ephemeral (`useState`, not persisted). On page load, no coupon is applied. User re-applies → `validateCoupon()` rejects expired code immediately. No fix needed.

### Campaign expiry fix

On every cart open (`isOpen` becomes `true`), `CartDrawer` re-fetches active campaigns and re-evaluates each line:

- **Campaign still active + matches product** → update `unitPriceOverride` to current discounted price (handles campaign value changes too)
- **No campaign matches / campaign expired** → clear `unitPriceOverride` (set to `undefined`) → `lineSubtotal` falls back to live product price

### Cart Store Addition

Add to `CartState` interface and implementation:

```ts
updatePriceOverride: (
  productId: string,
  unit: SaleUnit,
  stitching: Stitching,
  color: string,
  price: number | undefined,
) => void;
```

Implementation:

```ts
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

### CartDrawer Addition

`getActiveCampaigns()` uses `NEXT_PUBLIC_*` Supabase env vars — safe to call from client components.

Import at top of `CartDrawer.tsx`:

```ts
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
```

Also import `updatePriceOverride` from cart store.

Add a `useEffect` that triggers when `isOpen` becomes `true` AND `lines` and `productMap` are populated:

```ts
const { isOpen, close, lines, setQuantity, remove, updatePriceOverride } = useCart();

useEffect(() => {
  if (!isOpen || lines.length === 0) return;
  // Wait until products are loaded
  const loadedProductIds = [...productMap.keys()];
  if (!lines.every((l) => loadedProductIds.includes(l.productId))) return;

  getActiveCampaigns().then((campaigns) => {
    lines.forEach((line) => {
      const product = productMap.get(line.productId);
      if (!product) return;
      const campaign = getCampaignForProduct(product.id, product.category, campaigns);
      const discount = campaign
        ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign)
        : null;
      const freshPrice = discount?.discountedPricePerSuit;
      // Update regardless — sets new price or clears expired one
      if (freshPrice !== line.unitPriceOverride) {
        updatePriceOverride(line.productId, line.unit, line.stitching, line.color || "White", freshPrice);
      }
    });
  });
}, [isOpen, productMap, lines]);
```

The effect depends on `productMap` — it runs after the existing product-fetch effect populates it. This ensures we have product `category` available for `getCampaignForProduct`.

### Behavior After Fix

| Scenario | Before | After |
|----------|--------|-------|
| Campaign expires between sessions | Cart shows stale discounted price | Cart re-validates on open, shows original price |
| Campaign value changes (e.g. 20%→10%) | Cart shows old 20% | Cart updates to 10% on open |
| New campaign starts after item added | Item shows original price | Cart detects campaign, applies discount on open |
| No campaign ever | No change | No change |

## Implementation Detail

### Imports to add

```ts
import { getActiveCampaigns, getCampaignForProduct, computeDiscount } from "@/lib/campaigns";
```

### Fetch campaigns before item loop

```ts
const campaigns = await getActiveCampaigns();
```

Add this before the `Promise.all` that maps `validInput.lines` into `items`.

### Per-line unit price

Inside the `items` map, after `const product = await getProductByIdAsync(line.productId)`:

```ts
const campaign = getCampaignForProduct(product.id, product.category, campaigns);
const discount = campaign ? computeDiscount(product.pricePerSuit, product.pricePerMeter, campaign) : null;
const unitPrice = discount?.discountedPricePerSuit ?? product.pricePerSuit;
```

`line_total` and `unit_price` in `order_items` use `unitPrice` (discounted when campaign applies).

### Campaign discount computation

After `items` and `subtotal` (original) are computed:

```ts
const originalSubtotal = items.reduce((sum, it) => sum + it.original_line_total, 0);
const campaignDiscount = originalSubtotal - subtotal;
```

`original_line_total` = `product.pricePerSuit × quantity` (before campaign). `subtotal` = discounted sum.

> **Note:** `orders.subtotal` stores the **original** (pre-campaign) subtotal so it is consistent with the existing coupon flow where coupon is validated against `subtotal`.

Wait — this creates a complication. If `subtotal` stored in DB is original price but `total = subtotal + shipping - discountAmount`, then:

```
subtotal     = originalSubtotal  (original, pre-discount)
discountAmount = max(campaignDiscount, couponDiscount)
total        = max(0, originalSubtotal + shipping - discountAmount)
```

The `items` table stores per-line `unit_price` and `line_total` at the **discounted** price (for accurate line-item receipts). The `orders.discount_amount` accounts for the full discount separately.

### Max-wins logic replacing existing coupon block

Current code validates coupon and sets `discountAmount`. Replace the entire coupon block + total computation:

```ts
// Compute campaign discount
const originalSubtotal = items.reduce((sum, it) => sum + it.original_line_total, 0);
const campaignDiscount = originalSubtotal - subtotal;

// Re-validate coupon server-side (never trust client)
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

// Larger discount wins
const discountAmount = Math.max(campaignDiscount, couponDiscount);
// promo_id only stored if coupon wins
const storedPromoId = couponDiscount >= campaignDiscount ? validatedPromoId : null;

const shipping = originalSubtotal >= 10_000 ? 0 : 350;
const total = Math.max(0, originalSubtotal + shipping - discountAmount);
```

### `items` map change

Each item needs both `original_line_total` (for campaign discount calc) and `line_total` (discounted, for receipt). The `original_line_total` is a local computation variable only — NOT stored in `order_items` (no schema change needed).

```ts
const originalLineTotal = (product.pricePerSuit + stitchingAddon) * line.quantity;
const lineTotal = (unitPrice + stitchingAddon) * line.quantity;

return {
  // ... existing fields ...
  unit_price: unitPrice,         // discounted price per unit
  line_total: lineTotal,         // discounted line total
  original_line_total: originalLineTotal,  // local only, for campaignDiscount calc
};
```

After building `items`, compute `subtotal` (discounted) and `originalSubtotal` (pre-campaign):

```ts
const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
const originalSubtotal = items.reduce((sum, it) => sum + it.original_line_total, 0);
```

The `original_line_total` field is stripped before inserting into `order_items` (it's local only).

### `shipping` threshold

Shipping free-threshold uses `originalSubtotal` (consistent — based on what customer selected, not how much they pay after discount).

## Error Handling

- `getActiveCampaigns()` returns `[]` on error (already handles this internally). If no campaigns active, `campaignDiscount = 0` and coupon logic runs as before.
- No campaign = no change in behavior vs today.

## Constraints

- No schema migrations.
- `order_items.unit_price` and `order_items.line_total` will now reflect discounted prices when a campaign applies — correct for customer receipts/email.
- `orders.subtotal` stores original (pre-discount) subtotal — consistent with coupon flow.
- `orders.discount_amount` stores the winning discount amount.
- `orders.promo_id` is null when campaign wins (null = automatic campaign applied).
