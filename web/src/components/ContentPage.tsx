import type { ReactNode } from "react";

/**
 * Shared shell for the static help and legal pages, so they read as one set
 * rather than five separately-styled documents.
 */
export function ContentPage({
  eyebrow,
  title,
  intro,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  /** Shown as "Last updated" — legal pages need a visible revision date. */
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-16 sm:py-20">
      <p className="eyebrow text-muted">{eyebrow}</p>
      <h1 className="display mt-2 text-4xl sm:text-5xl">{title}</h1>
      {intro && <p className="mt-4 text-sm text-ink-soft leading-relaxed">{intro}</p>}
      {updated && <p className="mt-3 text-xs text-muted">Last updated {updated}</p>}

      <div className="mt-12 space-y-10">{children}</div>
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="display text-xl sm:text-2xl">{heading}</h2>
      <div className="mt-3 space-y-3 text-sm text-ink-soft leading-relaxed">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-ink-soft leading-relaxed">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="text-muted select-none">
            —
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
