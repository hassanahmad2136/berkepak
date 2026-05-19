"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Provider = "google" | "apple";

export function SocialAuthButtons({ next = "/account" }: { next?: string }) {
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sign = async (provider: Provider) => {
    setError(null);
    setBusy(provider);
    try {
      const supabase = createSupabaseBrowser();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(
            next,
          )}`,
          // Google asks for offline access so we get a refresh token.
          queryParams:
            provider === "google"
              ? { access_type: "offline", prompt: "consent" }
              : undefined,
        },
      });
      if (error) {
        setError(humanize(provider, error.message));
        setBusy(null);
      }
      // On success the browser is being navigated to the OAuth provider —
      // nothing more to do here.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => sign("google")}
        disabled={busy !== null}
        className="btn btn-ghost w-full inline-flex items-center justify-center gap-3"
      >
        <GoogleMark />
        <span>{busy === "google" ? "Redirecting…" : "Continue with Google"}</span>
      </button>

      <button
        type="button"
        onClick={() => sign("apple")}
        disabled={busy !== null}
        className="btn btn-ghost w-full inline-flex items-center justify-center gap-3"
      >
        <AppleMark />
        <span>{busy === "apple" ? "Redirecting…" : "Continue with Apple"}</span>
      </button>

      {error && <p className="text-xs text-accent">{error}</p>}
    </div>
  );
}

function humanize(provider: Provider, message: string): string {
  if (/provider is not enabled/i.test(message) || /unsupported/i.test(message)) {
    return `${provider === "google" ? "Google" : "Apple"} sign-in isn't enabled yet. Add credentials in Supabase → Auth → Providers.`;
  }
  return message;
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16.1 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8L6.1 32.7C9.3 39.5 16.1 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.6l6.2 5.2c-.4.4 6.6-4.8 6.6-14.8 0-1.3-.1-2.3-.4-3.5z"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z" />
    </svg>
  );
}
