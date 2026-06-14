import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // First, update the session (refresh auth cookies, etc.)
  let response = await updateSession(request);

  // Check if this is an admin route
  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.startsWith("/admin");

  if (isAdminRoute) {
    // Create a Supabase client to check authentication and admin status
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      // If Supabase env vars are missing, deny access
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Not authenticated: redirect to login with next param
    if (!user) {
      const redirect = request.nextUrl.clone();
      redirect.pathname = "/login";
      redirect.searchParams.set("next", request.nextUrl.pathname);
      return NextResponse.redirect(redirect);
    }

    // Authenticated, now check if admin via admin_users table (service role)
    const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminKey) {
      // Service role key missing, deny access
      return NextResponse.redirect(new URL("/", request.url));
    }

    // Service-role client with no-op cookie adapter (Edge Runtime compatible)
    const adminClient = createServerClient(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
    });

    const { data: adminUser, error } = await adminClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error || !adminUser) {
      // Not an admin: redirect to home
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
