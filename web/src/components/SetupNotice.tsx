import Link from "next/link";

export function SetupNotice({ feature }: { feature: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 sm:px-8 py-24 text-center">
      <p className="eyebrow text-muted">Setup required</p>
      <h1 className="display mt-3 text-3xl">
        {feature} needs a database connection.
      </h1>
      <p className="mt-4 text-sm text-muted">
        Start the data layer with{" "}
        <code className="bg-mist px-1 py-0.5">cd db &amp;&amp; docker compose up -d</code>, then add{" "}
        <code className="bg-mist px-1 py-0.5">DATABASE_URL</code> to{" "}
        <code className="bg-mist px-1 py-0.5">web/.env.local</code> and restart the dev
        server. See <code className="bg-mist px-1 py-0.5">.env.example</code> for the full list.
      </p>
      <Link href="/" className="btn btn-primary mt-8">
        Back to Home
      </Link>
    </div>
  );
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
