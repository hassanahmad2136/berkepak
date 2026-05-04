"use client";

import { useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="mt-8 max-w-sm text-sm text-muted">
        ✓ You're on the list. Look out for the next edit.
      </p>
    );
  }

  return (
    <form
      className="mt-8 flex max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (email) setDone(true);
      }}
    >
      <input
        type="email"
        placeholder="Email address"
        className="input flex-1"
        aria-label="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button className="btn btn-primary">Subscribe</button>
    </form>
  );
}
