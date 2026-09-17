import { SITE } from "./site";
import { onlinePaymentsEnabled } from "./online-payments";
import type { PaymentMethod } from "./types";

/**
 * Two price books, one catalog.
 *
 * `product_catalog` stores what Berke Pak must be left with per suit. While
 * online payment is switched on, the storefront shows that price grossed up
 * for the gateway's fee, so a PKR 3,000 suit is listed at PKR 3,158 when the
 * fee is 5%: PayFast takes 5% of what it charges, not of the stored price, so
 * adding 5% to 3,000 would still leave 2,992.50. Direct bank transfer carries
 * no gateway fee and is charged the stored price.
 *
 * While online payment is switched off there is no fee to recover, so listed
 * and net are the same price and every method pays the stored amount.
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
 * The fee listed prices are grossed up by right now: the configured PayFast
 * rate while online payment is on, and nothing while it is off — otherwise
 * cash-on-delivery customers would pay a gateway's fee on a gateway nobody used.
 */
export function activeGatewayFeePercent(): number {
  return onlinePaymentsEnabled() ? SITE.payments.gatewayFeePercent : 0;
}

/**
 * Whole rupees, like every other price on the site, and rounded **up**: the
 * remainder is a few paisa in the business's favour rather than a shortfall
 * against the stored price.
 */
export function listedPrice(net: number, feePercent = activeGatewayFeePercent()): number {
  if (!(feePercent > 0)) return Math.ceil(net);
  if (feePercent >= 100) {
    throw new Error(`Gateway fee must be below 100%, got ${feePercent}.`);
  }
  return Math.ceil(net / (1 - feePercent / 100));
}

export function priceOn(net: number, basis: PriceBasis): number {
  return basis === "listed" ? listedPrice(net) : net;
}
