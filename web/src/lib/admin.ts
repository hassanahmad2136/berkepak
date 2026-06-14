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
 * 2. admin_users table (service-role lookup, RLS-protected).
 *
 * SECURITY: user_metadata checks removed — users can self-modify metadata from browser console.
 * Now uses admin_users table with BYPASSRLS service role for secure lookup.
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

    // 2. Check admin_users table via service role (bypasses RLS)
    const { createSupabaseAdmin } = await import("@/lib/supabase/server");
    const adminClient = createSupabaseAdmin();

    const { data: adminUser, error } = await adminClient
      .from("admin_users")
      .select("user_id")
      .eq("user_id", data.user.id)
      .maybeSingle();

    if (error) {
      console.error("[AdminAuth] Error checking admin_users table:", error);
      return false;
    }

    if (adminUser) {
      return true;
    }

    return false;
  } catch (err) {
    console.error("[AdminAuth] Error checking administrator status:", err);
    return false;
  }
}
