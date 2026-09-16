import "server-only";
import { queryOne } from "@/lib/db";
import { getProductByIdAsync } from "@/lib/products";
import { computeDiscount, getCampaignForProduct, type Campaign } from "@/lib/campaigns";
import { getActiveCampaigns } from "@/lib/campaigns.server";
import { priceOn, type PriceBasis } from "@/lib/pricing";
import { SITE } from "@/lib/site";
import {
  BESPOKE_STITCHING_ADDON_PKR,
  type Product,
  type SaleUnit,
  type Stitching,
} from "@/lib/types";

/**
 * Prices an order on both price books at once.
 *
 * placeOrder charges from this and checkout displays from it, so the saving a
 * customer is shown for bank transfer is exactly the saving they get. There is
 * no second copy of this arithmetic in the browser to drift out of step.
 */

export interface QuoteLine {
  productId: string;
  unit: SaleUnit;
  quantity: number;
  stitching: Stitching;
  color?: string;
}

export interface PricedItem {
  product_id: string;
  product_name: string;
  product_slug: string;
  unit: SaleUnit;
  quantity: number;
  unit_price: number;
  stitching: Stitching;
  stitching_addon: number;
  line_total: number;
  original_line_total: number;
  color: string;
}

export interface Quote {
  basis: PriceBasis;
  items: PricedItem[];
  /** Before any discount. */
  subtotal: number;
  shipping: number;
  discountAmount: number;
  /** Set only when a coupon, rather than a campaign, supplied the discount. */
  promoId: string | null;
  total: number;
}

export interface OrderQuote {
  listed: Quote;
  net: Quote;
  /** listed.total − net.total: the gateway fee folded into listed prices. */
  gatewayFee: number;
}

interface PromoRow {
  id: string;
  discount_type: string;
  discount_value: string;
  min_order_amount: string;
  starts_at: Date | null;
  ends_at: Date | null;
}

export async function quoteOrder(lines: QuoteLine[], promoId?: string): Promise<OrderQuote> {
  const campaigns = await getActiveCampaigns();
  const products = await Promise.all(
    lines.map(async (line) => {
      const product = await getProductByIdAsync(line.productId);
      if (!product) throw new Error(`Unknown product ${line.productId}`);
      return product;
    }),
  );
  const promo = promoId ? await loadLivePromo(promoId) : null;

  const netItems = priceLines("net", lines, products, campaigns);
  // Shipping and coupon eligibility are judged on the net subtotal for both
  // books. Judged on listed prices, a basket just under the free-shipping line
  // would cross it only by paying the gateway fee — making bank transfer, the
  // cheaper method, the one that pays for delivery.
  const netSubtotal = sum(netItems, "original_line_total");

  const net = settle("net", netItems, netSubtotal, promo);
  const listed = settle("listed", priceLines("listed", lines, products, campaigns), netSubtotal, promo);

  return { listed, net, gatewayFee: Math.max(0, listed.total - net.total) };
}

function priceLines(
  basis: PriceBasis,
  lines: QuoteLine[],
  products: Product[],
  campaigns: Campaign[],
): PricedItem[] {
  return lines.map((line, i) => {
    const product = products[i];
    const suitPrice = priceOn(product.basePricePerSuit, basis);
    const meterPrice = priceOn(product.basePricePerMeter, basis);

    const campaign = getCampaignForProduct(product.id, product.category, campaigns);
    const discount = campaign ? computeDiscount(suitPrice, meterPrice, campaign) : null;
    const unitPrice = discount?.discountedPricePerSuit ?? suitPrice;
    const stitchingAddon =
      line.stitching === "bespoke" ? priceOn(BESPOKE_STITCHING_ADDON_PKR, basis) : 0;

    return {
      product_id: product.id,
      product_name: product.name,
      product_slug: product.slug,
      unit: line.unit,
      quantity: line.quantity,
      unit_price: unitPrice,
      stitching: line.stitching,
      stitching_addon: stitchingAddon,
      line_total: (unitPrice + stitchingAddon) * line.quantity,
      original_line_total: (suitPrice + stitchingAddon) * line.quantity,
      color: line.color || "White",
    };
  });
}

function settle(
  basis: PriceBasis,
  items: PricedItem[],
  netSubtotal: number,
  promo: PromoRow | null,
): Quote {
  const subtotal = sum(items, "original_line_total");
  const campaignDiscount = subtotal - sum(items, "line_total");
  const shipping = netSubtotal >= SITE.freeShippingThresholdPKR ? 0 : SITE.flatShippingPKR;

  let couponDiscount = 0;
  if (promo && netSubtotal >= Number(promo.min_order_amount ?? 0)) {
    couponDiscount =
      promo.discount_type === "pct"
        ? Math.floor(subtotal * (Number(promo.discount_value) / 100))
        : Math.min(Number(promo.discount_value), subtotal);
  }

  // Larger discount wins — campaign and coupon do not stack.
  const discountAmount = Math.max(campaignDiscount, couponDiscount);

  return {
    basis,
    items,
    subtotal,
    shipping,
    discountAmount,
    promoId: promo && couponDiscount >= campaignDiscount ? promo.id : null,
    total: Math.max(0, subtotal + shipping - discountAmount),
  };
}

/** Re-validated server-side on every quote; a client-held promo id proves nothing. */
async function loadLivePromo(promoId: string): Promise<PromoRow | null> {
  const promo = await queryOne<PromoRow>(
    `select id, discount_type, discount_value, min_order_amount, starts_at, ends_at
       from promotions
      where id = $1 and type = 'coupon' and is_active = true`,
    [promoId],
  );
  if (!promo) return null;

  const now = new Date();
  const started = !promo.starts_at || new Date(promo.starts_at) <= now;
  const notEnded = !promo.ends_at || new Date(promo.ends_at) >= now;
  return started && notEnded ? promo : null;
}

function sum(items: PricedItem[], key: "line_total" | "original_line_total"): number {
  return items.reduce((total, item) => total + item[key], 0);
}
