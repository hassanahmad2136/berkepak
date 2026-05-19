import Link from "next/link";
import { LoginForm } from "./LoginForm";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { isSupabaseConfigured, SetupNotice } from "@/components/SetupNotice";

export default async function LoginPage(props: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  if (!isSupabaseConfigured()) return <SetupNotice feature="Sign in" />;
  const { next, error } = await props.searchParams;

  return (
    <div className="mx-auto max-w-md px-4 sm:px-8 py-20">
      <p className="eyebrow text-muted">Account</p>
      <h1 className="display mt-2 text-4xl">Sign in</h1>

      {error && (
        <p className="mt-4 border border-accent/40 bg-mist px-3 py-2 text-xs text-accent">
          {error}
        </p>
      )}

      <LoginForm next={next} />

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-[0.18em] text-muted">
        <span className="h-px flex-1 bg-stone" /> or <span className="h-px flex-1 bg-stone" />
      </div>

      <SocialAuthButtons next={next} />

      <p className="mt-8 text-center text-sm text-muted">
        New to Berke Pak?{" "}
        <Link href="/signup" className="link-underline text-ink">
          Create an account
        </Link>
      </p>
    </div>
  );
}
