import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Auth callback for both email confirmation links and OAuth redirects.
 * Exchanges the `code` query param for a session, then redirects to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");
  const next = url.searchParams.get("next") || "/account";

  if (error) {
    const target = new URL("/login", url.origin);
    target.searchParams.set(
      "error",
      errorDescription || error || "Authentication failed.",
    );
    return NextResponse.redirect(target);
  }

  if (code) {
    const supabase = await createSupabaseServer();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      const target = new URL("/login", url.origin);
      target.searchParams.set("error", exchangeError.message);
      return NextResponse.redirect(target);
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
