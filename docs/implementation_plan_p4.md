# Saleor Checkout & Inventory Sync (Phase 4)

## Goal
Connect the storefront's "Place Order" button to Saleor so that inventory is accurately tracked and deducted. Currently, orders only save to Supabase. This plan will implement the full Saleor GraphQL checkout flow inside our Next.js server action, while preserving the Supabase save for custom business logic.

## Background
To create an order in Saleor, you cannot just say "create order". You must step through the e-commerce checkout flow programmatically:
1. Create a checkout with the items.
2. Attach the customer's shipping and billing address.
3. Select a delivery method (shipping).
4. Complete the checkout (which converts it into an Order and deducts inventory).

## User Review Required

> [!IMPORTANT]
> **Channel Configuration Requirement**
> Because our payment methods are "Cash on Delivery" and "Bank Transfer" (which happen outside of the website), the Saleor backend must allow orders to be placed without immediate credit card payment. Before this code goes live, you will need to go into your Saleor Dashboard -> Channels -> Default Channel and ensure **"Allow unpaid orders"** is checked. If it isn't, Saleor will block step 4.

## Proposed Changes

### 1. New GraphQL Mutations
We will add the necessary mutations to the GraphQL client layer.

#### [MODIFY] [queries.ts](file:///Users/abdullah/code/BerkePak/web/src/lib/saleor/queries.ts) (or rename to `api.ts`)
Add the following GraphQL mutations:
- `CHECKOUT_CREATE_MUTATION`: Initializes the checkout with variant IDs and quantities.
- `CHECKOUT_SHIPPING_ADDRESS_UPDATE_MUTATION`: Attaches the customer's address.
- `CHECKOUT_BILLING_ADDRESS_UPDATE_MUTATION`: Same as above.
- `CHECKOUT_DELIVERY_METHOD_UPDATE_MUTATION`: Selects the default shipping method.
- `CHECKOUT_COMPLETE_MUTATION`: Finalizes the order and deducts inventory.

### 2. Resolving Variant IDs
#### [MODIFY] [transforms.ts](file:///Users/abdullah/code/BerkePak/web/src/lib/saleor/transforms.ts)
Currently, our `Product` type only knows the generic "Product ID", but Saleor requires specific "Variant IDs" (e.g., the ID for the "Meter" variant vs the "Suit" variant) to add items to a checkout.
- We will update the `Product` type and transforms to expose `meterVariantId` and `suitVariantId`.

### 3. The Dual-Write Order Logic
#### [MODIFY] [orders.ts (server action)](file:///Users/abdullah/code/BerkePak/web/src/lib/actions/orders.ts)
We will rewrite the `placeOrder` function to orchestrate the entire flow safely:

**Step A: Saleor Flow**
1. Call `checkoutCreate` with the specific variant IDs the user selected.
2. Call `checkoutShippingAddressUpdate` and `checkoutBillingAddressUpdate` mapping our `input.address` to Saleor's format.
3. Call `checkoutDeliveryMethodUpdate` to assign shipping.
4. Call `checkoutComplete`. If successful, Saleor returns a final `Saleor Order ID`.

**Step B: Supabase Flow**
1. Take the `Saleor Order ID` and save the exact same order to Supabase.
2. Attach the bespoke stitching measurements and receipt upload status to the Supabase record.

> [!TIP]
> **Failure Handling:** If Saleor fails to create the checkout (e.g., out of stock), we immediately return an error to the user and *do not* save to Supabase. Saleor acts as the strict gatekeeper.

## Verification Plan

### Automated Tests
- `npm run typecheck` and `npm run build` to ensure all new GraphQL types align perfectly.

### Manual Verification
1. **End-to-End Checkout:** Add a fabric to the cart and place a COD order.
2. **Saleor Dashboard Check:** Log into the Saleor admin panel and verify the order appears and the inventory for that specific fabric variant decreased by the correct amount.
3. **Supabase Dashboard Check:** Verify the mirror order appears in Supabase with the bespoke measurements intact.
