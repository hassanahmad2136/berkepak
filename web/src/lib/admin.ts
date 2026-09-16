import { getCurrentUser, isAdmin, isAdminEmail } from "@/lib/auth/guards";

/**
 * Admin checks. The logic lives in lib/auth/guards.ts so that pages, actions
 * and the middleware cannot drift apart — which is exactly what happened when
 * this file honoured ADMIN_EMAILS and middleware.ts did not.
 */
export { isAdminEmail };

export async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    return await isAdmin(await getCurrentUser());
  } catch (err) {
    console.error("[AdminAuth] Error checking administrator status:", err);
    return false;
  }
}
