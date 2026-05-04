"use client";

import { useState, useTransition } from "react";
import { uploadReceipt } from "@/lib/actions/receipts";

export function ReceiptUploadForm({
  pendingOrderIds,
}: {
  pendingOrderIds: string[];
}) {
  const [orderId, setOrderId] = useState(pendingOrderIds[0] ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <div className="mt-8 border border-stone p-6">
        <p className="text-sm">
          ✓ Receipt uploaded for order <strong>{orderId}</strong>. We'll email
          you once it's reviewed.
        </p>
        <button
          onClick={() => {
            setDone(false);
            setOrderId(pendingOrderIds[0] ?? "");
            setFile(null);
          }}
          className="link-underline mt-4 text-sm"
        >
          Upload another
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-8 space-y-4 max-w-md"
      onSubmit={(e) => {
        e.preventDefault();
        if (!orderId || !file) return;
        setError(null);
        const fd = new FormData();
        fd.set("orderId", orderId);
        fd.set("file", file);
        startTransition(async () => {
          const res = await uploadReceipt(fd);
          if (res.ok) setDone(true);
          else setError(res.error);
        });
      }}
    >
      {pendingOrderIds.length > 0 ? (
        <select
          className="input"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
        >
          {pendingOrderIds.map((id) => (
            <option key={id} value={id}>
              {id}
            </option>
          ))}
        </select>
      ) : (
        <input
          className="input"
          placeholder="Order ID (e.g. BPK-XXXXXX)"
          value={orderId}
          onChange={(e) => setOrderId(e.target.value)}
          required
        />
      )}
      <label className="block border border-stone p-5 cursor-pointer">
        <p className="eyebrow text-muted">Receipt image</p>
        <p className="mt-2 text-sm">
          {file ? file.name : "Click to choose file (JPG, PNG, PDF — max 10 MB)"}
        </p>
        <input
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </label>
      {error && <p className="text-xs text-accent">{error}</p>}
      <button
        type="submit"
        className="btn btn-primary"
        disabled={!orderId || !file || pending}
      >
        {pending ? "Uploading…" : "Submit Receipt"}
      </button>
    </form>
  );
}
