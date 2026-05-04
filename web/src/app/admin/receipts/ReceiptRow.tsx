"use client";

import { useState, useTransition } from "react";
import { approveReceipt, rejectReceipt } from "@/lib/actions/admin";

type Props = {
  id: string;
  orderId: string;
  status: string;
  notes: string | null;
  signedUrl: string | null;
  createdAt: string;
  orderTotal: string;
  shippingName: string;
};

export function ReceiptRow(p: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  if (done) {
    return (
      <li className="border border-stone p-5 text-sm text-muted">
        Receipt {p.id.slice(0, 8)} updated.
      </li>
    );
  }

  return (
    <li className="border border-stone p-5">
      <div className="grid gap-5 sm:grid-cols-[160px_1fr_auto] sm:items-start">
        {p.signedUrl ? (
          <a
            href={p.signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block aspect-[3/4] bg-mist overflow-hidden border border-stone"
          >
            {/* Use plain <img> — signed URL is short-lived. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={p.signedUrl}
              alt="Receipt"
              className="h-full w-full object-cover"
            />
          </a>
        ) : (
          <div className="aspect-[3/4] bg-mist border border-stone" />
        )}

        <div className="text-sm">
          <p className="font-medium">{p.orderId}</p>
          <p className="text-muted mt-1">
            {p.shippingName} · {p.orderTotal}
          </p>
          <p className="text-xs text-muted mt-2">
            Uploaded {new Date(p.createdAt).toLocaleString()}
          </p>
          {p.notes && (
            <p className="text-xs text-muted mt-1">Notes: {p.notes}</p>
          )}
          {p.signedUrl && (
            <a
              href={p.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline mt-3 inline-block text-xs"
            >
              Open full size →
            </a>
          )}
        </div>

        {p.status === "pending" && (
          <div className="space-y-2 sm:w-44">
            <button
              className="btn btn-primary w-full"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const res = await approveReceipt(p.id);
                  if (res.ok) setDone(true);
                  else setError(res.error);
                });
              }}
            >
              {pending ? "…" : "Approve"}
            </button>

            {showReject ? (
              <div className="space-y-2">
                <textarea
                  className="input h-20 py-2"
                  placeholder="Reason (shown to customer)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <button
                  className="btn btn-ghost w-full"
                  disabled={pending || !reason.trim()}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const res = await rejectReceipt(p.id, reason.trim());
                      if (res.ok) setDone(true);
                      else setError(res.error);
                    });
                  }}
                >
                  {pending ? "…" : "Confirm Reject"}
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost w-full"
                onClick={() => setShowReject(true)}
              >
                Reject
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-accent">{error}</p>}
    </li>
  );
}
