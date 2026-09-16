"use client";

import { useState, useTransition } from "react";
import { advanceOrder, cancelOrder } from "@/lib/actions/fulfilment";
import {
  COURIERS,
  ORDER_STATUS_LABEL,
  canShip,
  isCancellable,
  nextStatus,
  type OrderStatus,
} from "@/lib/order-status";

/**
 * The buttons offer only what the rules allow, and the server checks the same
 * rules again — this is convenience, not permission.
 */
export function OrderActions({
  orderId,
  status,
  paymentMethod,
  paymentStatus,
}: {
  orderId: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [courier, setCourier] = useState<string>(COURIERS[0]);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");

  const next = nextStatus(status);
  const shipping = next === "shipped";
  const blockedFromShipping = shipping && !canShip(paymentMethod, paymentStatus);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };

  return (
    <div className="space-y-5">
      {next ? (
        <div className="space-y-3">
          {shipping && (
            <div className="grid gap-2 sm:grid-cols-2">
              <select
                className="input"
                value={courier}
                onChange={(e) => setCourier(e.target.value)}
                disabled={blockedFromShipping}
              >
                {COURIERS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Tracking number"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                disabled={blockedFromShipping}
              />
            </div>
          )}

          <button
            className="btn btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={
              pending || blockedFromShipping || (shipping && !trackingNumber.trim())
            }
            onClick={() =>
              run(() =>
                advanceOrder(
                  orderId,
                  next,
                  shipping ? { courier, trackingNumber } : undefined,
                ),
              )
            }
          >
            {pending ? "Saving…" : `Mark ${ORDER_STATUS_LABEL[next].toLowerCase()}`}
          </button>

          {blockedFromShipping && (
            <p className="text-xs text-accent">
              Not paid yet — approve the bank transfer, or wait for the payment to clear,
              before shipping.
            </p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">
          {status === "cancelled"
            ? "This order was cancelled."
            : "This order is complete."}
        </p>
      )}

      {isCancellable(status) &&
        (showCancel ? (
          <div className="space-y-2 border-t border-stone pt-4">
            <textarea
              className="input h-20 py-2"
              placeholder="Why is this being cancelled? (kept on the order)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {paymentStatus === "paid" && (
              <p className="text-xs text-accent">
                This order is paid. Cancelling returns the stock but does not refund
                anything — issue the refund yourself.
              </p>
            )}
            <div className="flex gap-2">
              <button
                className="btn btn-ghost flex-1 disabled:opacity-40"
                disabled={pending || !reason.trim()}
                onClick={() => run(() => cancelOrder(orderId, reason))}
              >
                {pending ? "…" : "Confirm cancel"}
              </button>
              <button className="btn btn-ghost flex-1" onClick={() => setShowCancel(false)}>
                Keep order
              </button>
            </div>
          </div>
        ) : (
          <button
            className="text-xs underline text-muted"
            onClick={() => setShowCancel(true)}
          >
            Cancel this order
          </button>
        ))}

      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
