import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default function SignupPage() {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Sign up" />;
  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Create account</h1>
      <p className="mt-2 text-sm text-muted">
        Sign in to track orders, manage receipts, and save measurements.
      </p>

      <SignupForm />

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
        <span className="h-px flex-1 bg-stone" /> or <span className="h-px flex-1 bg-stone" />
      </div>

      <div className="space-y-2">
        <button className="btn btn-ghost w-full" disabled>
          Continue with Google
        </button>
        <button className="btn btn-ghost w-full" disabled>
          Continue with Apple
        </button>
        <p className="text-center text-xs text-muted mt-2">
          Social sign-in coming soon.
        </p>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="link-underline text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
