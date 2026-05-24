"use client";

import { useActionState } from "react";
import { forgotPasswordAction } from "@/lib/actions/auth";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPasswordAction,
    undefined
  );

  if (state?.success) {
    return (
      <div className="mt-8 border border-stone p-6 bg-stone-50/50 rounded-lg animate-in fade-in zoom-in-95 duration-150">
        <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
          <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 19v-8.93a2 2 0 01.89-1.664l8-5.333a2 2 0 012.22 0l8 5.333A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-2.25-1.5a2 2 0 00-2.22 0l-2.25 1.5" />
          </svg>
          <span>Reset Link Dispatched</span>
        </p>
        <p className="mt-2 text-xs text-muted leading-relaxed">
          We have sent a secure password recovery link to your email address. Please open your inbox and click the reset link to configure a new password.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-4">
      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink" htmlFor="email-input">Email Address</label>
        <input
          type="email"
          name="email"
          id="email-input"
          placeholder="e.g. name@example.com"
          className="input bg-white focus:border-ink focus:outline-none transition-colors"
          required
          autoComplete="email"
          disabled={pending}
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 font-medium" id="forgot-password-error">
          ⚠️ {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary w-full cursor-pointer active:scale-[0.99] transition-all"
        disabled={pending}
      >
        {pending ? "Sending link…" : "Send Reset Link"}
      </button>
    </form>
  );
}
