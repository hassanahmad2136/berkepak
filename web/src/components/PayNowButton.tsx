"use client";

import { useState, useTransition } from "react";
import { startOrderPayment } from "@/lib/actions/payments";

/** Opens a fresh gateway attempt for an order that is not yet paid. */
export function PayNowButton({
  orderId,
  guestToken,
  label,
}: {
  orderId: string;
  guestToken?: string;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await startOrderPayment(orderId, guestToken);
            if (res.ok && res.redirectUrl) {
              window.location.href = res.redirectUrl;
              return;
            }
            setError(res.ok ? "The payment page could not be opened." : res.error);
          });
        }}
      >
        {pending ? "Opening payment…" : label}
      </button>
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </div>
  );
}
