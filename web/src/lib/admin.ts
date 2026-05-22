import { createSupabaseServer } from "@/lib/supabase/server";

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

/**
 * Robust administrator auth check.
 * Validates against:
 * 1. ADMIN_EMAILS environment variable whitelist.
 * 2. Supabase Auth user metadata (`is_admin: true` or `role: 'admin'`).
 * 3. Supabase profiles table (`is_admin: true`).
 */
export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const supabase = await createSupabaseServer();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return false;

    // 1. Check email whitelist
    if (data.user.email && isAdminEmail(data.user.email)) {
      return true;
    }

    // 2. Check auth metadata
    if (
      data.user.user_metadata?.is_admin === true ||
      data.user.user_metadata?.role === "admin"
    ) {
      return true;
    }

    // 3. Check profiles table
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", data.user.id)
      .maybeSingle();

    if (profile && (profile as any).is_admin === true) {
      return true;
    }

    return false;
  } catch (err) {
    console.error("[AdminAuth] Error checking administrator status:", err);
    return false;
  }
}
