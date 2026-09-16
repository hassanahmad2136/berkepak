import "server-only";
import { query, queryOne, transaction } from "@/lib/db";
import { sendPaymentConfirmedEmail } from "@/lib/actions/email-actions";
import { getProvider } from "./registry";
import { TERMINAL_STATUSES, type PaymentMethodKind, type PaymentStatus } from "./types";

/**
 * Payment lifecycle. Everything that moves money through a gateway goes through
 * here so the ordering guarantees live in one place:
 *
 *   - a webhook is applied at most once, even under redelivery;
 *   - an order is only ever marked paid from a verified provider event;
 *   - an underpaid event never marks an order paid;
 *   - a terminal payment never moves again.
 */

export interface PaymentRow {
  id: string;
  order_id: string;
  provider: string;
  method: string;
  provider_ref: string | null;
  amount: string;
  status: PaymentStatus;
  redirect_url: string | null;
  qr_payload: string | null;
  failure_reason: string | null;
  raw_response: unknown;
}

/** Starts an attempt for an order and returns whatever the customer needs next. */
export async function startPayment(opts: {
  orderId: string;
  /** Defaults to the first method the configured provider supports. */
  method?: PaymentMethodKind;
  customer: { email: string; name?: string | null; phone?: string | null };
  returnUrl: string;
  origin: string;
}): Promise<PaymentRow> {
  const provider = getProvider();
  const method = opts.method ?? provider.supports[0];

  if (!provider.supports.includes(method)) {
    throw new Error(`${provider.name} does not support ${method}.`);
  }

  const order = await queryOne<{ id: string; total: string; payment_status: string }>(
    `select id, total, payment_status from orders where id = $1`,
    [opts.orderId],
  );
  if (!order) throw new Error("Order not found.");
  if (order.payment_status === "paid") throw new Error("Order is already paid.");

  const amount = Number(order.total);

  // Record the attempt before calling out, so a provider that answers slowly
  // (or not at all) still leaves a trace to reconcile against.
  const created = await queryOne<PaymentRow>(
    `insert into payments (order_id, provider, method, amount, status, raw_request)
     values ($1, $2, $3, $4, 'initiated', $5::jsonb)
     returning *`,
    [opts.orderId, provider.name, method, amount, JSON.stringify({ ...opts, method, amount })],
  );
  if (!created) throw new Error("Could not record the payment attempt.");

  try {
    const result = await provider.initiate({
      orderId: opts.orderId,
      amountPKR: amount,
      method,
      customer: opts.customer,
      returnUrl: opts.returnUrl,
      origin: opts.origin,
    });

    const updated = await queryOne<PaymentRow>(
      `update payments
          set provider_ref = $1, status = $2, redirect_url = $3,
              qr_payload = $4, raw_response = $5::jsonb
        where id = $6
        returning *`,
      [
        result.providerRef,
        result.status,
        result.redirectUrl ?? null,
        result.qrPayload ?? null,
        JSON.stringify(result.raw ?? {}),
        created.id,
      ],
    );

    await query(`update orders set payment_status = 'pending' where id = $1`, [opts.orderId]);
    return updated!;
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    await query(`update payments set status = 'failed', failure_reason = $1 where id = $2`, [
      reason,
      created.id,
    ]);
    throw err;
  }
}

export type WebhookOutcome =
  | {
      ok: true;
      applied: boolean;
      status: PaymentStatus;
      providerRef: string;
      orderId?: string;
    }
  | { ok: false; reason: string };

/**
 * Applies a verified provider callback.
 *
 * `applied: false` means the event was recognised but changed nothing — a
 * redelivery, or an event for an already-settled payment. That is a success,
 * not an error: providers retry until they get a 2xx.
 */
export async function applyWebhook(
  providerName: string,
  rawBody: string,
  headers: Record<string, string>,
): Promise<WebhookOutcome> {
  const provider = getProvider(providerName);
  const verified = await provider.verifyWebhook(rawBody, headers);
  if (!verified.ok) return { ok: false, reason: verified.reason };

  const providerRef = verified.providerRef;

  return transaction(async (client) => {
    // Claim the event id first. A concurrent redelivery loses the race here and
    // is reported as a no-op rather than crediting the order twice.
    const claim = await client.query(
      `insert into payment_events (provider, event_id, status, payload)
       values ($1, $2, $3, $4::jsonb)
       on conflict (provider, event_id) do nothing
       returning id`,
      [provider.name, verified.eventId, verified.status, JSON.stringify(verified.raw)],
    );
    if (claim.rowCount === 0) {
      return { ok: true as const, applied: false, status: verified.status, providerRef };
    }

    const found = await client.query<PaymentRow>(
      `select * from payments where provider = $1 and provider_ref = $2 for update`,
      [provider.name, providerRef],
    );
    const payment = found.rows[0];
    if (!payment) {
      return { ok: false as const, reason: `No payment for reference ${providerRef}.` };
    }

    await client.query(`update payment_events set payment_id = $1 where id = $2`, [
      payment.id,
      claim.rows[0].id,
    ]);

    // Settled is settled — a late "failed" must not un-pay a shipped order.
    if (TERMINAL_STATUSES.includes(payment.status)) {
      return { ok: true as const, applied: false, status: payment.status, providerRef };
    }

    let status = verified.status;
    let failureReason = verified.failureReason ?? null;

    // A signature proves who sent the result, not that the right amount moved;
    // PayFast's hash does not cover the amount at all. Money did move on an
    // underpayment, so it is neither paid nor failed: it is held for a person.
    if (
      status === "paid" &&
      verified.amountPKR !== undefined &&
      verified.amountPKR < Number(payment.amount)
    ) {
      status = "pending";
      failureReason =
        `Held for review: gateway reported PKR ${verified.amountPKR}, ` +
        `order expects PKR ${Number(payment.amount)}.`;
    }

    await client.query(
      `update payments set status = $1, failure_reason = $2 where id = $3`,
      [status, failureReason, payment.id],
    );

    if (status === "paid") {
      await client.query(
        `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
        [payment.order_id],
      );
    } else if (status !== "pending") {
      await client.query(`update orders set payment_status = 'failed' where id = $1`, [
        payment.order_id,
      ]);
    }

    return {
      ok: true as const,
      applied: true,
      status,
      providerRef,
      orderId: payment.order_id,
    };
  });
}

/** Sends the "payment received" email. Called after the transaction commits. */
export async function notifyPaid(orderId: string): Promise<void> {
  const row = await queryOne<{ email: string | null }>(
    `select coalesce(u.email, o.guest_email) as email
       from orders o left join users u on u.id = o.user_id
      where o.id = $1`,
    [orderId],
  );
  if (row?.email) await sendPaymentConfirmedEmail(orderId, row.email);
}

export async function getPaymentByRef(
  providerName: string,
  providerRef: string,
): Promise<PaymentRow | null> {
  return queryOne<PaymentRow>(
    `select * from payments where provider = $1 and provider_ref = $2`,
    [providerName, providerRef],
  );
}

/** The order page the attempt was started from, recorded server-side at start. */
export async function returnUrlFor(
  providerName: string,
  providerRef: string,
): Promise<string | null> {
  const row = await queryOne<{ return_url: string | null }>(
    `select raw_request->>'returnUrl' as return_url
       from payments where provider = $1 and provider_ref = $2`,
    [providerName, providerRef],
  );
  return row?.return_url ?? null;
}

/**
 * Safety net for a webhook that never arrived. Asks the provider directly and
 * applies the answer. Run it on a schedule once a real gateway is live.
 */
export async function reconcilePending(olderThanMinutes = 10): Promise<number> {
  const provider = getProvider();
  const stale = await query<PaymentRow>(
    `select * from payments
      where provider = $1 and status in ('initiated','pending')
        and provider_ref is not null
        and created_at < now() - ($2 || ' minutes')::interval`,
    [provider.name, String(olderThanMinutes)],
  );

  let settled = 0;
  for (const payment of stale) {
    try {
      const { status } = await provider.fetchStatus(payment.provider_ref!);
      if (status === payment.status) continue;

      await query(`update payments set status = $1 where id = $2`, [status, payment.id]);
      if (status === "paid") {
        await query(
          `update orders set payment_status = 'paid', status = 'confirmed' where id = $1`,
          [payment.order_id],
        );
        await notifyPaid(payment.order_id).catch(() => {});
      }
      settled++;
    } catch (err) {
      console.error(`[payments] reconcile failed for ${payment.provider_ref}:`, err);
    }
  }
  return settled;
}
