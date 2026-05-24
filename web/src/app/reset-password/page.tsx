import { ResetPasswordForm } from "./ResetPasswordForm";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default async function ResetPasswordPage() {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Password reset" />;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Secure Access</p>
      <h1 className="display mt-2 text-4xl">New password</h1>
      <p className="mt-2 text-xs text-muted">
        Please configure a new secure, robust password for your account. Passwords must be at least 8 characters long.
      </p>

      <ResetPasswordForm />
    </div>
  );
}
