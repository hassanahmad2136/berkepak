import Link from "next/link";

export function SetupNotice({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
      <p className="eyebrow text-muted">Setup required</p>
      <h1 className="display mt-3 text-3xl">
        {feature} needs Supabase to be configured.
      </h1>
      <p className="mt-4 text-sm text-muted">
        Add <code className="bg-mist px-1 py-0.5">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        and{" "}
        <code className="bg-mist px-1 py-0.5">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        to a <code className="bg-mist px-1 py-0.5">.env.local</code> file in{" "}
        <code className="bg-mist px-1 py-0.5">BerkePak/web/</code>, then restart
        the dev server. See <code className="bg-mist px-1 py-0.5">.env.example</code> for the full list.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Back to Home
      </Link>
    </div>
  );
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
