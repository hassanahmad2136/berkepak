import "server-only";
import { Pool, type QueryResultRow } from "pg";

/**
 * Postgres access for the whole app. Replaces the Supabase client.
 *
 * Every query here runs over a trusted connection with no row-level security
 * behind it — the 34 RLS policies that used to scope reads to auth.uid() are
 * gone. Any query touching user-owned rows MUST filter by the session's user
 * id itself. See lib/auth/guards.ts.
 */

declare global {
  // Reused across hot reloads in dev; without this Next opens a new pool per reload.
  var __berkepakPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "[db] DATABASE_URL is not set. Expected e.g. postgresql://berkepak:berkepak_dev@localhost:5433/berkepak",
    );
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    // Managed providers (Neon/RDS) terminate non-TLS connections; local Docker has no certs.
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
}

export const pool: Pool = globalThis.__berkepakPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__berkepakPool = pool;

/** Run a parameterised query. Never interpolate values into the SQL string. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query<T>(text, params);
  return result.rows;
}

/** First row, or null. */
export async function queryOne<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction, rolling back on any thrown error. */
export async function transaction<T>(
  fn: (client: import("pg").PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
