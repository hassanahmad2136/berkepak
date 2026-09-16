"use client";

import { useEffect, useRef } from "react";

/** Submits itself on load; the button is there for a browser that blocks it. */
export function AutoSubmitForm({
  action,
  fields,
}: {
  action: string;
  fields: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);
  const submitted = useRef(false);

  useEffect(() => {
    // Effects run twice in development; a second submit would race the first.
    if (submitted.current) return;
    submitted.current = true;
    form.current?.submit();
  }, []);

  return (
    <form ref={form} method="POST" action={action} className="mt-8">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button type="submit" className="btn btn-primary">
        Continue to PayFast
      </button>
    </form>
  );
}
