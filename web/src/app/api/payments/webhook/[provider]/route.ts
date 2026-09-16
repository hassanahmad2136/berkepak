import { NextResponse } from "next/server";
import { applyWebhook, notifyPaid } from "@/lib/payments/service";

/**
 * Payment callbacks land here. One route serves every provider; which one is
 * in the path, and the adapter verifies its own signature.
 *
 * Two rules a payment webhook must obey:
 *  1. Authenticity is decided from the RAW payload — parsing first would let a
 *     forged request through on a body that re-serialises differently.
 *  2. Anything recognised returns 2xx, including a redelivery. Returning an
 *     error for a duplicate makes providers retry forever.
 */
async function handle(provider: string, rawBody: string, request: Request) {
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  let result;
  try {
    result = await applyWebhook(provider, rawBody, headers);
  } catch (err) {
    console.error(`[payments] webhook processing failed for ${provider}:`, err);
    // 500 asks the provider to retry — correct when our side broke.
    return NextResponse.json({ error: "Processing failed." }, { status: 500 });
  }

  if (!result.ok) {
    // Rejected as unauthentic or unknown. Do not invite a retry.
    console.warn(`[payments] rejected ${provider} webhook: ${result.reason}`);
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }

  // Email only on the transition, so a redelivery does not mail the customer twice.
  if (result.applied && result.status === "paid" && result.orderId) {
    try {
      await notifyPaid(result.orderId);
    } catch (err) {
      console.error("[payments] payment confirmation email failed:", err);
    }
  }

  return NextResponse.json({ received: true, applied: result.applied, status: result.status });
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  return handle(provider, await request.text(), request);
}

/**
 * PayFast calls its CHECKOUT_URL with the result in the query string. That
 * query string is the payload verified, exactly as a POST body would be.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  return handle(provider, new URL(request.url).search.slice(1), request);
}
