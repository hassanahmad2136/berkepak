import Link from "next/link";
import { SignupForm } from "./SignupForm";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default function SignupPage() {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Sign up" />;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Create account</h1>
      <p className="mt-2 text-sm text-muted">
        Track orders, manage receipts, and save measurements for bespoke stitching.
      </p>

      <SignupForm />

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
        <span className="h-px flex-1 bg-stone" /> or <span className="h-px flex-1 bg-stone" />
      </div>

      <SocialAuthButtons />

      <p className="mt-8 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="link-underline text-ink">
          Sign in
        </Link>
      </p>
    </div>
  );
}
