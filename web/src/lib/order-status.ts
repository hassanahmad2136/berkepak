import type { PaymentMethod } from "./types";

/**
 * The order lifecycle, in one place.
 *
 * The admin buttons and the server action both read these rules, so the UI can
 * never offer a move the action will refuse — and the action never trusts the
 * UI for it either.
 */

export type OrderStatus =
  | "unconfirmed"
  | "confirmed"
  | "fulfilled"
  | "shipped"
  | "delivered"
  | "cancelled";

/** The line an order walks. Cancelled sits outside it. */
export const ORDER_FLOW: OrderStatus[] = [
  "unconfirmed",
  "confirmed",
  "fulfilled",
  "shipped",
  "delivered",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  unconfirmed: "Unconfirmed",
  confirmed: "Confirmed",
  fulfilled: "Packed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** What each step means to the customer reading their order page. */
export const ORDER_STATUS_BLURB: Record<OrderStatus, string> = {
  unconfirmed: "Waiting for payment.",
  confirmed: "Payment received. We're preparing your order.",
  fulfilled: "Packed and waiting for the courier.",
  shipped: "On its way to you.",
  delivered: "Delivered.",
  cancelled: "This order was cancelled.",
};

/** The single step an order may take from here, or null at the end. */
export function nextStatus(current: OrderStatus | string): OrderStatus | null {
  const i = ORDER_FLOW.indexOf(current as OrderStatus);
  if (i < 0 || i === ORDER_FLOW.length - 1) return null;
  return ORDER_FLOW[i + 1];
}

/**
 * Cancellable only before it leaves the building. Once a courier has it,
 * getting it back is a return, which is a different process with different
 * money attached.
 */
export function isCancellable(status: OrderStatus | string): boolean {
  return status === "unconfirmed" || status === "confirmed" || status === "fulfilled";
}

/**
 * Whether an order may leave the building.
 *
 * Cash on delivery is paid at the door. Everything else must have cleared
 * first: shipping an unpaid bank transfer means the suit and the money are
 * both gone, and that is exactly the mistake an admin in a hurry makes.
 */
export function canShip(
  paymentMethod: PaymentMethod | string,
  paymentStatus: string,
): boolean {
  return paymentMethod === "cod" || paymentStatus === "paid";
}

/** Couriers Berke Pak actually books. "Other" keeps the field honest. */
export const COURIERS = [
  "TCS",
  "Leopards",
  "M&P",
  "BlueEx",
  "PostEx",
  "Call Courier",
  "Other",
] as const;
