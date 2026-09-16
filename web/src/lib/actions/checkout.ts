"use server";

import type { z } from "zod";
import { PlaceOrderSchema } from "@/lib/validation";
import { quoteOrder, type Quote } from "@/lib/order-pricing";
import { checkRateLimit } from "@/lib/rate-limit";

export type QuoteTotals = {
  subtotal: number;
  shipping: number;
  discountAmount: number;
  total: number;
};

export type CheckoutQuoteResult =
  | { ok: true; listed: QuoteTotals; net: QuoteTotals; bankTransferSaves: number }
  | { ok: false; error: string };

const QuoteInput = PlaceOrderSchema.pick({ lines: true, promoId: true });

/**
 * Both totals for the current cart, from the same function placeOrder charges
 * with — so the bank-transfer saving on screen is the one the customer gets.
 */
export async function quoteCheckout(
  input: z.infer<typeof QuoteInput>,
): Promise<CheckoutQuoteResult> {
  const rl = await checkRateLimit("checkout_quote", 60);
  if (!rl.success) return { ok: false, error: rl.error ?? "Too many requests." };

  const parsed = QuoteInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const quote = await quoteOrder(parsed.data.lines, parsed.data.promoId);
    return {
      ok: true,
      listed: totals(quote.listed),
      net: totals(quote.net),
      bankTransferSaves: quote.gatewayFee,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not price the cart." };
  }
}

function totals(q: Quote): QuoteTotals {
  return {
    subtotal: q.subtotal,
    shipping: q.shipping,
    discountAmount: q.discountAmount,
    total: q.total,
  };
}
