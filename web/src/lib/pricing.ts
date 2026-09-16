import { SITE } from "./site";
import type { PaymentMethod } from "./types";

/**
 * Two price books, one catalog.
 *
 * `product_catalog` stores what Berke Pak must be left with per suit. The
 * storefront shows that price grossed up for the online gateway's fee, so a
 * PKR 3,000 suit is listed at PKR 3,158 when the fee is 5%: PayFast takes 5%
 * of what it charges, not of the stored price, so adding 5% to 3,000 would
 * still leave 2,992.50. Direct bank transfer carries no gateway fee and is
 * charged the stored price — which is why checkout can truthfully say it
 * costs less.
 *
 *   net     the stored catalog price; what bank transfer charges
 *   listed  net grossed up for the fee; what the site shows and every other
 *           method charges
 */
export type PriceBasis = "listed" | "net";

export function basisFor(method: PaymentMethod): PriceBasis {
  return method === "bank_transfer" ? "net" : "listed";
}

/**
 * Whole rupees, like every other price on the site, and rounded **up**: the
 * remainder is a few paisa in the business's favour rather than a shortfall
 * against the stored price.
 */
export function listedPrice(net: number): number {
  const pct = SITE.payments.gatewayFeePercent;
  if (!(pct > 0)) return Math.ceil(net);
  if (pct >= 100) {
    throw new Error(`SITE.payments.gatewayFeePercent must be below 100, got ${pct}.`);
  }
  return Math.ceil(net / (1 - pct / 100));
}

export function priceOn(net: number, basis: PriceBasis): number {
  return basis === "listed" ? listedPrice(net) : net;
}
