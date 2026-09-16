import "server-only";
import crypto from "crypto";
import { query, queryOne } from "@/lib/db";

/**
 * Single-use, time-limited tokens for email verification and password reset.
 * Same discipline as sessions: the emailed value is random, only its hash is
 * stored, and consuming a token stamps `used_at` so a link cannot be replayed.
 */

export type TokenKind = "verify" | "reset";

const TABLE: Record<TokenKind, string> = {
  verify: "email_verification_tokens",
  reset: "password_reset_tokens",
};

const TTL_MINUTES: Record<TokenKind, number> = {
  verify: 60 * 24, // a day — people check email late
  reset: 60,       // an hour — shorter, it changes credentials
};

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a token, returning the raw value to embed in an email link. */
export async function issueToken(kind: TokenKind, userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + TTL_MINUTES[kind] * 60_000);

  // Supersede any outstanding token of this kind so only the newest link works.
  await query(`update ${TABLE[kind]} set used_at = now() where user_id = $1 and used_at is null`, [
    userId,
  ]);
  await query(
    `insert into ${TABLE[kind]} (user_id, token_hash, expires_at) values ($1, $2, $3)`,
    [userId, hashToken(token), expiresAt],
  );
  return token;
}

/**
 * Validates and burns a token in one step. Returns the owning user id, or null
 * when the token is unknown, expired, or already used.
 */
export async function consumeToken(kind: TokenKind, token: string): Promise<string | null> {
  if (!token) return null;
  const row = await queryOne<{ user_id: string }>(
    `update ${TABLE[kind]}
        set used_at = now()
      where token_hash = $1
        and used_at is null
        and expires_at > now()
      returning user_id`,
    [hashToken(token)],
  );
  return row?.user_id ?? null;
}
