"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { signMockPayload } from "@/lib/payments/providers/mock";

/**
 * Sends a signed callback to our own webhook, imitating the gateway.
 *
 * Deliberately goes over HTTP rather than calling applyWebhook() directly:
 * that way signature verification, idempotency and the route handler are all
 * genuinely under test, not bypassed.
 */
export async function simulateProviderCallback(
  providerRef: string,
  status: "paid" | "failed",
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  if (process.env.NODE_ENV === "production") {
    return { ok: false, error: "Not available in production." };
  }

  const origin = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const body = JSON.stringify({
    eventId: `evt_${crypto.randomBytes(10).toString("hex")}`,
    providerRef,
    status,
    reason: status === "failed" ? "Declined in sandbox" : undefined,
  });

  try {
    const res = await fetch(`${origin}/api/payments/webhook/mock`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-signature": signMockPayload(body),
      },
      body,
    });
    const json = (await res.json().catch(() => ({}))) as {
      applied?: boolean;
      status?: string;
      error?: string;
    };

    if (!res.ok) return { ok: false, error: json.error ?? `Webhook returned ${res.status}.` };

    revalidatePath(`/pay/sandbox/${providerRef}`);
    return {
      ok: true,
      message: json.applied
        ? `Webhook accepted — payment marked ${json.status}.`
        : `Webhook accepted but changed nothing (already ${json.status}).`,
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Callback failed." };
  }
}
