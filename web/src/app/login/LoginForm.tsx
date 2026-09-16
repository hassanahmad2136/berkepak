"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, type AuthState } from "@/lib/actions/auth";
import { ConfirmationPanel } from "@/app/signup/SignupForm";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginAction,
    undefined,
  );

  // An unverified account cannot sign in; show the same "check your email"
  // panel as signup, with its resend button, instead of failing silently.
  if (state && "pendingConfirmation" in state && state.pendingConfirmation) {
    return <ConfirmationPanel email={state.email} />;
  }

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <input type="hidden" name="next" value={next ?? "/account"} />
      <input
        type="email"
        name="email"
        placeholder="Email"
        className="input"
        required
        autoComplete="email"
      />
      <div className="space-y-1.5">
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="input"
          required
          autoComplete="current-password"
        />
        <div className="flex justify-end text-xs px-1">
          <Link href="/forgot-password" className="link-underline text-muted hover:text-ink transition-colors">
            Forgot password?
          </Link>
        </div>
      </div>
      {state && "error" in state && (
        <p className="text-xs text-accent">{state.error}</p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
