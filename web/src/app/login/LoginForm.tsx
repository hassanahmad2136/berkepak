"use client";

import { useActionState } from "react";
import { loginAction, type AuthState } from "@/lib/actions/auth";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    loginAction,
    undefined,
  );

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
      <input
        type="password"
        name="password"
        placeholder="Password"
        className="input"
        required
        autoComplete="current-password"
      />
      {state?.error && (
        <p className="text-xs text-accent">{state.error}</p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
