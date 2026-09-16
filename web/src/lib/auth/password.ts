import "server-only";
import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing. argon2id with parameters that cost roughly 50ms per hash
 * on a modern server — slow enough to hurt offline cracking, fast enough that
 * a login does not feel sluggish.
 */
// `Algorithm` is an ambient const enum, which isolatedModules forbids importing;
// 2 is Argon2id.
const OPTIONS = {
  algorithm: 2,
  memoryCost: 19456, // 19 MiB — OWASP minimum for argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifyPassword(plain: string, digest: string): Promise<boolean> {
  try {
    return await verify(digest, plain, OPTIONS);
  } catch {
    // Malformed or unrecognised hash — treat as a failed login, never a crash.
    return false;
  }
}

/**
 * A real argon2id hash of a throwaway value. Login verifies against this when
 * the email is unknown, so the response takes the same time either way and
 * timing cannot be used to enumerate registered addresses.
 */
const DUMMY_DIGEST =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHR2YWx1ZQ$B2mZ0mhVBaCK0R0kJqB4Yf1qJvHDfBSPtVQK1sVW5uQ";

export async function dummyVerify(plain: string): Promise<void> {
  await verifyPassword(plain, DUMMY_DIGEST);
}
