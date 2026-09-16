import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { query, queryOne } from "@/lib/db";

/**
 * Server-side sessions, replacing Supabase's JWT cookies.
 *
 * The cookie holds an opaque random token; the database stores only its
 * SHA-256 hash. A database dump therefore yields no usable sessions, and
 * logout / password reset revoke access immediately — which a stateless JWT
 * could not do.
 */

export const SESSION_COOKIE = "bp_session";
const SESSION_TTL_DAYS = 30;
/** Refresh the expiry when a session is more than this far through its life. */
const SLIDING_REFRESH_AFTER_DAYS = 1;

export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  emailVerifiedAt: Date | null;
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function ttl(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000);
}

/**
 * Issues a brand-new session. Always call this on login rather than reusing an
 * existing token — reusing one across a privilege change invites session fixation.
 */
export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = ttl();

  await query(
    `insert into sessions (user_id, token_hash, user_agent, ip, expires_at)
     values ($1, $2, $3, $4, $5)`,
    [userId, hashToken(token), meta.userAgent ?? null, meta.ip ?? null, expiresAt],
  );

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Resolves the current session to a user, or null. Expired rows are treated as
 * absent and cleaned up opportunistically.
 */
export async function readSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await queryOne<{
    session_id: string;
    expires_at: Date;
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    email_verified_at: Date | null;
  }>(
    `select s.id as session_id, s.expires_at,
            u.id, u.email, u.full_name, u.phone, u.email_verified_at
       from sessions s
       join users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  if (!row) return null;

  // Sliding expiry: extend a session that is being actively used.
  const remaining = row.expires_at.getTime() - Date.now();
  const fullLife = SESSION_TTL_DAYS * 86_400_000;
  if (fullLife - remaining > SLIDING_REFRESH_AFTER_DAYS * 86_400_000) {
    const next = ttl();
    await query(`update sessions set expires_at = $1 where id = $2`, [next, row.session_id]);
    try {
      store.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        expires: next,
      });
    } catch {
      // Server Components cannot set cookies; the DB row is extended regardless.
    }
  }

  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    emailVerifiedAt: row.email_verified_at,
  };
}

/** Logout: drops the row so the token is dead even if the cookie survives. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await query(`delete from sessions where token_hash = $1`, [hashToken(token)]);
  }
  store.delete(SESSION_COOKIE);
}

/** Used after a password reset: every other device is signed out. */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await query(`delete from sessions where user_id = $1`, [userId]);
}
