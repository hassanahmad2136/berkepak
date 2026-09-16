import Link from "next/link";
import { ResetPasswordForm } from "./ResetPasswordForm";

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  if (!token) {
    return (
      <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
        <p className="eyebrow text-muted">Secure Access</p>
        <h1 className="display mt-2 text-4xl">Link required</h1>
        <p className="mt-3 text-sm text-muted">
          Open the reset link from your email to choose a new password.
        </p>
        <Link href="/forgot-password" className="btn btn-primary mt-8">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Secure Access</p>
      <h1 className="display mt-2 text-4xl">New password</h1>
      <p className="mt-2 text-xs text-muted">
        Please configure a new secure, robust password for your account. Passwords must be at least 8 characters long.
      </p>

      <ResetPasswordForm token={token} />
    </div>
  );
}
