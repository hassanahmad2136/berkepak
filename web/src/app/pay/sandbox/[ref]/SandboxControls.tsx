"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { simulateProviderCallback } from "./actions";

/**
 * Approve / decline buttons. These do not touch the database directly — they
 * ask the server to POST a signed callback at our own webhook, so the path
 * being exercised is the live one.
 */
export function SandboxControls({
  providerRef,
  orderId,
}: {
  providerRef: string;
  orderId: string;
}) {
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = (status: "paid" | "failed") => {
    setError(null);
    setResult(null);
    start(async () => {
      const res = await simulateProviderCallback(providerRef, status);
      if (res.ok) setResult(res.message);
      else setError(res.error);
    });
  };

  if (result) {
    return (
      <div className="mt-8 border border-stone p-6">
        <p className="text-sm">{result}</p>
        <Link href={`/order/${orderId}`} className="btn btn-primary mt-6">
          Back to the order
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-3">
      <button
        onClick={() => send("paid")}
        disabled={pending}
        className="btn btn-primary w-full disabled:opacity-40"
      >
        {pending ? "Sending…" : "Approve payment"}
      </button>
      <button
        onClick={() => send("failed")}
        disabled={pending}
        className="btn btn-ghost w-full disabled:opacity-40"
      >
        Decline
      </button>
      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}
