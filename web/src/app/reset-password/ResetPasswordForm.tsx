"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/lib/actions/auth";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(
    resetPasswordAction,
    undefined
  );

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {/* The reset token comes from the emailed link and is verified server-side. */}
      <input type="hidden" name="token" value={token} />

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink" htmlFor="password-input">New Password</label>
        <input
          type="password"
          name="password"
          id="password-input"
          placeholder="Minimum 8 characters"
          className="input bg-white focus:border-ink focus:outline-none transition-colors"
          required
          autoComplete="new-password"
          minLength={8}
          disabled={pending}
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-semibold text-ink" htmlFor="confirm-password-input">Confirm New Password</label>
        <input
          type="password"
          name="confirmPassword"
          id="confirm-password-input"
          placeholder="Re-enter new password"
          className="input bg-white focus:border-ink focus:outline-none transition-colors"
          required
          autoComplete="new-password"
          minLength={8}
          disabled={pending}
        />
      </div>

      {state?.error && (
        <p className="text-xs text-red-600 font-medium" id="reset-password-error">
          ⚠️ {state.error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary w-full cursor-pointer active:scale-[0.99] transition-all"
        disabled={pending}
      >
        {pending ? "Resetting password…" : "Save New Password"}
      </button>
    </form>
  );
}
