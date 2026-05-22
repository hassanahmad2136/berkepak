"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServer } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getProductByIdAsync, getProductBySlug } from "@/lib/products";
import { saleorFetch, isSaleorConfigured, SaleorError } from "@/lib/saleor/client";
import {
  CHECKOUT_CREATE_MUTATION,
  CHECKOUT_SHIPPING_ADDRESS_UPDATE_MUTATION,
  CHECKOUT_BILLING_ADDRESS_UPDATE_MUTATION,
  CHECKOUT_DELIVERY_METHOD_UPDATE_MUTATION,
  CHECKOUT_COMPLETE_MUTATION,
} from "@/lib/saleor/queries";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type Address,
  type CartLine,
  type PaymentMethod,
  type SaleUnit,
} from "@/lib/types";

export type PlaceOrderInput = {
  lines: CartLine[];
  address: Address;
  paymentMethod: PaymentMethod;
  otpVerified: boolean;
};

export type PlaceOrderResult =
  | { ok: true; orderId: string }
  | { ok: false; error: string };

const CHANNEL = process.env.NEXT_PUBLIC_SALEOR_CHANNEL ?? "default-channel";
const MUTATION_TIMEOUT = 10_000;

function newOrderId(): string {
  return "BPK-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

function toSaleorAddress(addr: Address) {
  const nameParts = addr.fullName.trim().split(/\s+/);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ") || firstName;
  return {
    firstName,
    lastName,
    streetAddress1: addr.line1,
    streetAddress2: addr.line2 ?? "",
    city: addr.city,
    countryArea: addr.province,
    postalCode: addr.postalCode,
    country: "PK" as const,
    phone: addr.phone,
  };
}

// ---------------------------------------------------------------------------
// Saleor checkout types (response shapes)
// ---------------------------------------------------------------------------

interface SaleorCheckoutCreateResponse {
  checkoutCreate: {
    checkout: {
      id: string;
      shippingMethods: Array<{ id: string; name: string }>;
    } | null;
    errors: Array<{ field: string | null; message: string; code: string }>;
  };
}

interface SaleorShippingAddressResponse {
  checkoutShippingAddressUpdate: {
    checkout: {
      id: string;
      shippingMethods: Array<{ id: string; name: string }>;
    } | null;
    errors: Array<{ field: string | null; message: string; code: string }>;
  };
}

interface SaleorBillingAddressResponse {
  checkoutBillingAddressUpdate: {
    checkout: { id: string } | null;
    errors: Array<{ field: string | null; message: string; code: string }>;
  };
}

interface SaleorDeliveryMethodResponse {
  checkoutDeliveryMethodUpdate: {
    checkout: { id: string } | null;
    errors: Array<{ field: string | null; message: string; code: string }>;
  };
}

interface SaleorCheckoutCompleteResponse {
  checkoutComplete: {
    order: { id: string; number: string } | null;
    errors: Array<{ field: string | null; message: string; code: string }>;
  };
}

// ---------------------------------------------------------------------------
// Main placeOrder
// ---------------------------------------------------------------------------

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const rateLimit = await checkRateLimit("checkout_place", 5);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error ?? "Too many requests." };
  }

  const supabase = await createSupabaseServer();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { ok: false, error: "Please sign in to place an order." };

  if (input.lines.length === 0) return { ok: false, error: "Cart is empty." };
  if (input.paymentMethod === "cod" && !input.otpVerified) {
    return { ok: false, error: "Mobile number must be verified for Cash on Delivery." };
  }

  // Recompute totals server-side so the client cannot tamper with prices.
  const items = await Promise.all(input.lines.map(async (line) => {
    let product = await getProductByIdAsync(line.productId);
    if (!product) throw new Error(`Unknown product ${line.productId}`);

    // If it's a static fallback product ID (starts with "p-"), try to upgrade it
    // to the matching live Saleor product by slug so variant IDs resolve successfully.
    if (product.id.startsWith("p-") || !product.suitVariantId) {
      const liveProduct = getProductBySlug(product.slug);
      if (liveProduct && !liveProduct.id.startsWith("p-")) {
        product = liveProduct;
      }
    }

    const unitPrice = product.pricePerSuit;
    const stitchingAddon =
      line.stitching === "bespoke"
        ? BESPOKE_STITCHING_ADDON_PKR
        : 0;
    const lineTotal = (unitPrice + stitchingAddon) * line.quantity;

    const variantId = product.suitVariantId;

    return {
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      unit: line.unit as SaleUnit,
      quantity: line.quantity,
      unit_price: unitPrice,
      stitching: line.stitching,
      stitching_addon: stitchingAddon,
      line_total: lineTotal,
      variantId,
    };
  }));

  const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);
  const shipping = subtotal >= 10_000 ? 0 : 350;
  const total = subtotal + shipping;

  // -----------------------------------------------------------------------
  // Step A: Saleor checkout flow (gatekeeper for inventory)
  // -----------------------------------------------------------------------
  let saleorOrderId: string | undefined;
  let saleorOrderNumber: string | undefined;

  if (isSaleorConfigured()) {
    const mutationOpts = { cache: "no-store" as const, timeout: MUTATION_TIMEOUT };

    // Verify all variant IDs resolved
    const missingVariant = items.find((it) => !it.variantId);
    if (missingVariant) {
      return {
        ok: false,
        error: `Could not resolve variant for "${missingVariant.product_name}" (${missingVariant.unit}). Please contact support.`,
      };
    }

    // 1. Create checkout
    const checkoutLines = items.map((it) => ({
      variantId: it.variantId!,
      quantity: it.quantity,
    }));

    let checkoutId: string;
    try {
      const createRes = await saleorFetch<SaleorCheckoutCreateResponse>(
        CHECKOUT_CREATE_MUTATION,
        { channel: CHANNEL, lines: checkoutLines, email: `${input.address.phone.replace(/[^0-9]/g, "")}@berkepak.local` },
        mutationOpts,
      );
      if (createRes.checkoutCreate.errors.length > 0) {
        return { ok: false, error: createRes.checkoutCreate.errors[0].message };
      }
      checkoutId = createRes.checkoutCreate.checkout!.id;
    } catch (err) {
      const msg = err instanceof SaleorError ? err.message : "Saleor checkout failed.";
      return { ok: false, error: msg };
    }

    // 2. Attach shipping + billing address
    const saleorAddress = toSaleorAddress(input.address);
    try {
      const shippingRes = await saleorFetch<SaleorShippingAddressResponse>(
        CHECKOUT_SHIPPING_ADDRESS_UPDATE_MUTATION,
        { id: checkoutId, shippingAddress: saleorAddress },
        mutationOpts,
      );
      if (shippingRes.checkoutShippingAddressUpdate.errors.length > 0) {
        return { ok: false, error: shippingRes.checkoutShippingAddressUpdate.errors[0].message };
      }

      // Pick first available shipping method
      const shippingMethods =
        shippingRes.checkoutShippingAddressUpdate.checkout?.shippingMethods ?? [];

      const billingRes = await saleorFetch<SaleorBillingAddressResponse>(
        CHECKOUT_BILLING_ADDRESS_UPDATE_MUTATION,
        { id: checkoutId, billingAddress: saleorAddress },
        mutationOpts,
      );
      if (billingRes.checkoutBillingAddressUpdate.errors.length > 0) {
        return { ok: false, error: billingRes.checkoutBillingAddressUpdate.errors[0].message };
      }

      // 3. Select delivery method
      if (shippingMethods.length > 0) {
        const deliveryRes = await saleorFetch<SaleorDeliveryMethodResponse>(
          CHECKOUT_DELIVERY_METHOD_UPDATE_MUTATION,
          { id: checkoutId, deliveryMethodId: shippingMethods[0].id },
          mutationOpts,
        );
        if (deliveryRes.checkoutDeliveryMethodUpdate.errors.length > 0) {
          return { ok: false, error: deliveryRes.checkoutDeliveryMethodUpdate.errors[0].message };
        }
      }
    } catch (err) {
      const msg = err instanceof SaleorError ? err.message : "Address/delivery update failed.";
      return { ok: false, error: msg };
    }

    // 4. Complete checkout
    try {
      const completeRes = await saleorFetch<SaleorCheckoutCompleteResponse>(
        CHECKOUT_COMPLETE_MUTATION,
        { id: checkoutId },
        mutationOpts,
      );
      if (completeRes.checkoutComplete.errors.length > 0) {
        return { ok: false, error: completeRes.checkoutComplete.errors[0].message };
      }
      saleorOrderId = completeRes.checkoutComplete.order!.id;
      saleorOrderNumber = completeRes.checkoutComplete.order!.number;
    } catch (err) {
      const msg = err instanceof SaleorError ? err.message : "Checkout completion failed.";
      return { ok: false, error: msg };
    }
  }

  // -----------------------------------------------------------------------
  // Step B: Save to Supabase (with Saleor Order ID if available)
  // -----------------------------------------------------------------------
  const orderId = saleorOrderNumber ?? newOrderId();

  const { error: orderErr } = await supabase.from("orders").insert({
    id: orderId,
    user_id: userData.user.id,
    status: input.paymentMethod === "cod" ? "confirmed" : "unconfirmed",
    payment_method: input.paymentMethod,
    payment_status:
      input.paymentMethod === "bank_transfer" ? "awaiting_receipt" : "pending",
    subtotal,
    shipping,
    total,
    shipping_address: input.address,
    otp_verified: input.otpVerified,
  });
  if (orderErr) return { ok: false, error: orderErr.message };

  const { error: itemsErr } = await supabase
    .from("order_items")
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
    })));
  if (itemsErr) return { ok: false, error: itemsErr.message };

  revalidatePath("/account/orders");
  return { ok: true, orderId };
}
