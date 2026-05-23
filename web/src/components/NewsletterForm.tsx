"use client";

import { useState, useTransition } from "react";
import { subscribeToNewsletter } from "@/lib/actions/newsletter";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (done) {
    return (
      <p className="mt-8 max-w-sm text-sm text-emerald-800 font-semibold animate-in fade-in duration-200">
        ✓ You're on the list. Look out for the next edit.
      </p>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError(null);
    startTransition(async () => {
      const res = await subscribeToNewsletter(email);
      if (res.ok) {
        setDone(true);
      } else {
        setError(res.error || "Subscription failed.");
      }
    });
  };

  return (
    <form className="mt-8 flex flex-col gap-2 max-w-sm" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <input
          type="email"
          placeholder="Email address"
          className="input flex-1 bg-white focus:border-ink focus:outline-none transition-colors"
          aria-label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={pending}
        />
        <button className="btn btn-primary cursor-pointer active:scale-95 transition-all" disabled={pending}>
          {pending ? "..." : "Subscribe"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 font-medium px-1">⚠️ {error}</p>}
    </form>
  );
}
