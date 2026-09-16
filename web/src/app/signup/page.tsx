import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { isDatabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default function SignupPage() {
  if (!isDatabaseConfigured()) return <SetupNotice feature="Sign up" />;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Create account</h1>
      <p className="mt-2 text-sm text-muted">
        Track orders, manage receipts, and save items to your wishlist.
      </p>

      <SignupForm />

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="link-underline text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
