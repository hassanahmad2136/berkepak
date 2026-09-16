"use server";

import { revalidatePath } from "next/cache";
import { query, queryOne, transaction } from "@/lib/db";
import { getCurrentUser, isAdmin } from "@/lib/auth/guards";
import { sendOrderShippedEmail } from "@/lib/actions/email-actions";
import { canShip, isCancellable, nextStatus, type OrderStatus } from "@/lib/order-status";

export type FulfilmentResult = { ok: true } | { ok: false; error: string };

/**
 * Moving an order along. Admin only, and every rule is enforced here rather
 * than in the buttons: the buttons are a convenience, this is the gate.
 */

// Same shape as the guard in lib/actions/admin.ts, kept local because every
// export of a "use server" module becomes a callable server action, and a
// permission check is not something to expose as one.
async function requireAdmin(): Promise<FulfilmentResult> {
  const user = await getCurrentUser();
  if (!(await isAdmin(user))) return { ok: false, error: "Not an admin." };
  return { ok: true };
}

interface OrderRow {
  id: string;
  status: string;
  payment_method: string;
  payment_status: string;
}

async function loadOrder(orderId: string): Promise<OrderRow | null> {
  return queryOne<OrderRow>(
    `select id, status, payment_method, payment_status from orders where id = $1`,
    [orderId],
  );
}

function refresh(orderId: string): void {
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/account/orders");
  revalidatePath(`/order/${orderId}`);
}

/**
 * Advances an order exactly one step. `shipment` is required for the step into
 * "shipped" — an order marked shipped with no tracking is one the customer
 * cannot chase and we cannot prove we sent.
 */
export async function advanceOrder(
  orderId: string,
  to: OrderStatus,
  shipment?: { courier: string; trackingNumber: string },
): Promise<FulfilmentResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const order = await loadOrder(orderId);
  if (!order) return { ok: false, error: "Order not found." };

  const from = order.status;
  if (nextStatus(from) !== to) {
    return { ok: false, error: `An order cannot go from ${from} to ${to}.` };
  }

  let moved: { id: string }[];

  if (to === "shipped") {
    if (!canShip(order.payment_method, order.payment_status)) {
      return {
        ok: false,
        error:
          "This order is not paid. Approve the bank transfer, or wait for the payment to clear, before shipping it.",
      };
    }

    const courier = shipment?.courier?.trim() ?? "";
    const trackingNumber = shipment?.trackingNumber?.trim() ?? "";
    if (!courier || !trackingNumber) {
      return { ok: false, error: "Courier and tracking number are both required to ship." };
    }
    if (courier.length > 40 || trackingNumber.length > 60) {
      return { ok: false, error: "Courier or tracking number is too long." };
    }

    // `and status = $4` makes this a no-op if another admin moved the order
    // first, rather than overwriting whatever they did.
    moved = await query<{ id: string }>(
      `update orders
          set status = 'shipped', courier = $2, tracking_number = $3, shipped_at = now()
        where id = $1 and status = $4
        returning id`,
      [orderId, courier, trackingNumber, from],
    );
  } else if (to === "delivered") {
    moved = await query<{ id: string }>(
      `update orders set status = 'delivered', delivered_at = now()
        where id = $1 and status = $2
        returning id`,
      [orderId, from],
    );
  } else {
    moved = await query<{ id: string }>(
      `update orders set status = $2 where id = $1 and status = $3 returning id`,
      [orderId, to, from],
    );
  }

  if (moved.length === 0) {
    return { ok: false, error: "This order has already moved on. Reload and try again." };
  }

  refresh(orderId);

  if (to === "shipped") {
    // Never fail a dispatch over an email that would not send.
    try {
      const row = await queryOne<{ email: string | null }>(
        `select coalesce(u.email, o.guest_email) as email
           from orders o left join users u on u.id = o.user_id
          where o.id = $1`,
        [orderId],
      );
      if (row?.email) await sendOrderShippedEmail(orderId, row.email);
    } catch (err) {
      console.error("[fulfilment] shipped email failed:", err);
    }
  }

  return { ok: true };
}

/**
 * Cancels an order and returns its suits to stock.
 *
 * Both halves run in one transaction, and the update only matches an order
 * that has not been cancelled already — so a double click cannot restock the
 * same order twice and quietly inflate inventory.
 */
export async function cancelOrder(orderId: string, reason: string): Promise<FulfilmentResult> {
  const auth = await requireAdmin();
  if (!auth.ok) return auth;

  const order = await loadOrder(orderId);
  if (!order) return { ok: false, error: "Order not found." };
  if (!isCancellable(order.status)) {
    return { ok: false, error: `A ${order.status} order cannot be cancelled here.` };
  }

  const note = reason.trim();
  if (!note) return { ok: false, error: "A cancellation reason is required." };

  const cancelled = await transaction(async (client) => {
    const res = await client.query(
      `update orders
          set status = 'cancelled', cancelled_at = now(), cancel_reason = $2
        where id = $1 and cancelled_at is null
        returning id`,
      [orderId, note.slice(0, 300)],
    );
    if (res.rowCount === 0) return false;

    await client.query(`select restock_order_items($1)`, [orderId]);
    return true;
  });

  if (!cancelled) return { ok: false, error: "This order was already cancelled." };

  refresh(orderId);
  return { ok: true };
}
