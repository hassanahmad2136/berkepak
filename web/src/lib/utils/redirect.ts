/**
 * Validates a `next` redirect param to prevent open-redirect attacks.
 * Only allows same-origin relative paths that start with / and not //.
 * Rejects paths longer than 200 chars.
 */
export function safeRedirectPath(next: string | null | undefined): string {
  if (!next || typeof next !== "string") return "/account";
  if (next.length > 200) return "/account";
  if (!next.startsWith("/") || next.startsWith("//")) return "/account";
  return next;
}
