"use client";

import { useActionState } from "react";
import { signupAction, type AuthState } from "@/lib/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    signupAction,
    undefined,
  );

  return (
    <form action={formAction} className="mt-8 space-y-3">
      <input type="text" name="fullName" placeholder="Full name" className="input" required />
      <input type="email" name="email" placeholder="Email" className="input" required autoComplete="email" />
      <input type="tel" name="phone" placeholder="Mobile number" className="input" required autoComplete="tel" />
      <input
        type="password"
        name="password"
        placeholder="Password (8+ characters)"
        className="input"
        required
        minLength={8}
        autoComplete="new-password"
      />
      {state?.error && <p className="text-xs text-accent">{state.error}</p>}
      <button type="submit" className="btn btn-primary w-full" disabled={pending}>
        {pending ? "Creating account…" : "Create Account"}
      </button>
    </form>
  );
}
