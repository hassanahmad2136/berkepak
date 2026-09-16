import "server-only";
import { redirect } from "next/navigation";
import { queryOne } from "@/lib/db";
import { readSession, type SessionUser } from "./session";

/**
 * The only sanctioned way for application code to learn who is signed in.
 *
 * These replace the 34 RLS policies that used to scope queries to auth.uid().
 * A guard tells you *who* the caller is; it does not filter your query for you.
 * Every statement that reads or writes user-owned rows still needs its own
 * `where user_id = $1` — that is now the entire protection against one customer
 * seeing another's orders, receipts, addresses or wishlist.
 */

export type { SessionUser };

export async function getCurrentUser(): Promise<SessionUser | null> {
  return readSession();
}

/** For pages and actions that require a signed-in customer. */
export async function requireUser(nextPath?: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return user;
}

/**
 * Single source of admin truth for both pages and middleware-adjacent checks.
 *
 * Admin comes from either the ADMIN_EMAILS allowlist or a row in admin_users.
 * Previously lib/admin.ts honoured both while middleware.ts checked only
 * admin_users, so an ADMIN_EMAILS admin saw the dashboard link and was bounced
 * on click. One function now answers the question everywhere.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export async function isAdmin(user: SessionUser | null): Promise<boolean> {
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  const row = await queryOne<{ user_id: string }>(
    `select user_id from admin_users where user_id = $1`,
    [user.id],
  );
  return !!row;
}

/** Convenience for layouts: who is signed in, and are they an admin? */
export async function getCurrentUserWithRole(): Promise<{
  user: SessionUser | null;
  admin: boolean;
}> {
  const user = await getCurrentUser();
  return { user, admin: await isAdmin(user) };
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!(await isAdmin(user))) redirect("/");
  return user;
}
