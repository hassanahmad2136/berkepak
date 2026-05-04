import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Sign in" />;
  const { next } = await props.searchParams;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Sign in</h1>

      <LoginForm next={next} />

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
        New to Berke Pak?{" "}
        <Link href="/signup" className="link-underline text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
