import { NextResponse } from "next/server";
import { applyWebhook, notifyPaid, returnUrlFor } from "@/lib/payments/service";

/**
 * Where a hosted checkout sends the customer's browser back.
 *
 * The redirect carries the same signed result as the server-to-server
 * callback, so it is verified and applied the same way. That matters here: the
 * callback can be late, or unable to reach a site hosted on a home connection,
 * and a customer who has paid should not land on "payment pending". Both carry
 * the same event id, so whichever arrives second changes nothing.
 */
async function settle(request: Request, provider: string, raw: string) {
  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin).replace(
    /\/$/,
    "",
  );

  let outcome: Awaited<ReturnType<typeof applyWebhook>> | null = null;
  try {
    outcome = await applyWebhook(provider, raw, {});
  } catch (err) {
    console.error(`[payments] ${provider} return processing failed:`, err);
  }

  if (!outcome?.ok) {
    if (outcome) console.warn(`[payments] rejected ${provider} return: ${outcome.reason}`);
    return NextResponse.redirect(`${origin}/help/contact?payment=unverified`, 303);
  }

  if (outcome.applied && outcome.status === "paid" && outcome.orderId) {
    try {
      await notifyPaid(outcome.orderId);
    } catch (err) {
      console.error("[payments] payment confirmation email failed:", err);
    }
  }

  // Back to the order the attempt was started from — recorded server-side
  // when it started, never taken from the request, so this is no open redirect.
  const target = new URL(
    (await returnUrlFor(provider, outcome.providerRef)) ?? `${origin}/account/orders`,
  );
  target.searchParams.set("payment", outcome.status);
  return NextResponse.redirect(target, 303);
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  return settle(request, provider, new URL(request.url).search.slice(1));
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ provider: string }> },
) {
  const { provider } = await ctx.params;
  return settle(request, provider, await request.text());
}
