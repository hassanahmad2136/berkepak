import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * NOT A SECURITY BOUNDARY.
 *
 * The Edge runtime cannot open a Postgres connection, so this cannot verify
 * that a session token is real, unexpired, or attached to an admin. All it does
 * is bounce obviously-anonymous visitors away from private routes so they get a
 * login page instead of a flash of empty UI.
 *
 * Real enforcement lives in requireUser() / requireAdmin() (lib/auth/guards.ts),
 * which every protected layout, page and server action must call for itself.
 */
const SESSION_COOKIE = "bp_session";
const PROTECTED = ["/account", "/admin"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!PROTECTED.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (!request.cookies.get(SESSION_COOKIE)?.value) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"],
};
