"use client";

import { useActionState, useState, useTransition } from "react";
import {
  resendConfirmationAction,
  signupAction,
  type AuthState,
} from "@/lib/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signupAction,
    undefined,
  );

  if (state && "pendingConfirmation" in state && state.pendingConfirmation) {
    return <ConfirmationPanel email={state.email} />;
  }

  const errorMsg = state && "error" in state ? state.error : null;

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <input
        type="text"
        name="fullName"
        placeholder="Full name"
        className="input"
        required
        autoComplete="name"
      />
      <input
        type="email"
        name="email"
        placeholder="Email"
        className="input"
        required
        autoComplete="email"
      />
      <input
        type="tel"
        name="phone"
        placeholder="Mobile number (e.g. 03001234567)"
        className="input"
        required
        autoComplete="tel"
        pattern="(?:\+92|0)3\d{9}"
        title="Pakistani mobile number, e.g. 03001234567 or +923001234567"
      />
      <input
        type="password"
        name="password"
        placeholder="Password (8+ characters)"
        className="input"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {errorMsg && <p className="text-xs text-accent">{errorMsg}</p>}
      <button
        type="submit"
        className="btn btn-primary w-full"
        disabled={pending}
      >
        {pending ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}

export function ConfirmationPanel({ email }: { email: string }) {
  const [resendPending, startResend] = useTransition();
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-8 border border-stone bg-mist p-8 text-center fade-up"
    >
      <div
        aria-hidden
        className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-ink"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M3 6h18v12H3z" />
          <path d="M3 6l9 7 9-7" />
        </svg>
      </div>
      <p className="display mt-5 text-2xl">Check your email.</p>
      <p className="mt-3 text-sm text-ink-soft">
        We've sent a confirmation link to
        <br />
        <strong className="break-all">{email}</strong>
      </p>
      <p className="mt-3 text-xs text-muted">
        Click the link to activate your account. The link is valid for 24
        hours. Don't see it? Check your spam folder.
      </p>

      <div className="mt-6">
        {resent ? (
          <p className="text-xs text-muted">Confirmation email re-sent.</p>
        ) : (
          <button
            type="button"
            disabled={resendPending}
            onClick={() => {
              setError(null);
              startResend(async () => {
                const res = await resendConfirmationAction(email);
                if (res && "error" in res) setError(res.error);
                else setResent(true);
              });
            }}
            className="link-underline text-xs"
          >
            {resendPending ? "Re-sending…" : "Re-send confirmation email"}
          </button>
        )}
        {error && <p className="mt-2 text-xs text-accent">{error}</p>}
      </div>
    </div>
  );
}
