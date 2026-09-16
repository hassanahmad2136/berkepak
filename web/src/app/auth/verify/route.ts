import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { consumeToken } from "@/lib/auth/tokens";

/**
 * Email confirmation link. Replaces Supabase's /auth/callback code exchange.
 * The token is single-use and time-limited — consumeToken burns it atomically,
 * so a second click on the same link fails.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";

  const userId = await consumeToken("verify", token);
  if (!userId) {
    const target = new URL("/login", url.origin);
    target.searchParams.set(
      "error",
      "That confirmation link has expired or already been used. Sign in to request a new one.",
    );
    return NextResponse.redirect(target);
  }

  await query(
    `update users set email_verified_at = coalesce(email_verified_at, now()) where id = $1`,
    [userId],
  );

  const target = new URL("/login", url.origin);
  target.searchParams.set("error", "Email confirmed. Please sign in.");
  return NextResponse.redirect(target);
}
