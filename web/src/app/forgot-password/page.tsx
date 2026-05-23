import Link from "next/link";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default async function ForgotPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Password reset" />;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account Recovery</p>
      <h1 className="display mt-2 text-4xl">Reset password</h1>
      <p className="mt-2 text-xs text-muted">
        Enter your account email below. We'll send you a secure link to reset your password.
      </p>

      <ForgotPasswordForm />

      <p className="mt-8 text-center text-sm text-muted">
        Remembered your password?{" "}
        <Link href="/login" className="link-underline text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
