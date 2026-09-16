"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { query, queryOne } from "@/lib/db";
import { hashPassword, verifyPassword, dummyVerify } from "@/lib/auth/password";
import { createSession, destroySession, destroyAllSessionsForUser } from "@/lib/auth/session";
import { issueToken, consumeToken } from "@/lib/auth/tokens";
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email/auth-emails";
import { safeRedirectPath } from "@/lib/utils/redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { SignupSchema, LoginSchema } from "@/lib/validation";

export type AuthState =
  | undefined
  | { error: string }
  | { pendingConfirmation: true; email: string };

/** One message for every credential failure — never reveals whether an email exists. */
const CREDENTIALS_REJECTED = "Invalid email or password.";

function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, "");
}

async function siteOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function requestMeta() {
  const h = await headers();
  return {
    userAgent: h.get("user-agent"),
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Development escape hatch. Verification-before-login makes SMTP a hard
 * dependency: with mail down, nobody can register at all. This lets local work
 * continue when Mailpit is not running. It is ignored in production.
 */
function autoVerifyInDev(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.AUTH_AUTO_VERIFY === "true";
}

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rl = await checkRateLimit("auth_signup", 5, 60000);
  if (!rl.success) return { error: "Too many signup attempts. Please wait a minute." };

  const parsed = SignupSchema.safeParse({
    fullName: String(formData.get("fullName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: normalizePhone(String(formData.get("phone") ?? "").trim()),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { fullName, email, phone, password } = parsed.data;

  const existing = await queryOne<{ id: string; email_verified_at: Date | null }>(
    `select id, email_verified_at from users where lower(email) = lower($1)`,
    [email],
  );

  if (existing) {
    // Do not confirm that the address is taken. An unverified account gets a
    // fresh link; a verified one is told to sign in, which it already could.
    if (!existing.email_verified_at) {
      await sendVerification(existing.id, email);
    }
    return { pendingConfirmation: true, email };
  }

  const passwordHash = await hashPassword(password);
  const verified = autoVerifyInDev();

  const created = await queryOne<{ id: string }>(
    `insert into users (email, password_hash, full_name, phone, email_verified_at)
     values ($1, $2, $3, $4, $5)
     returning id`,
    [email, passwordHash, fullName, phone, verified ? new Date() : null],
  );
  if (!created) return { error: "Could not create the account. Please try again." };

  if (verified) {
    await createSession(created.id, await requestMeta());
    revalidatePath("/", "layout");
    redirect("/account");
  }

  await sendVerification(created.id, email);
  return { pendingConfirmation: true, email };
}

async function sendVerification(userId: string, email: string): Promise<void> {
  const token = await issueToken("verify", userId);
  try {
    await sendVerificationEmail(email, await siteOrigin(), token);
  } catch (err) {
    // The account exists and the token is valid; surface the failure in logs so
    // a broken SMTP config is visible rather than silently stranding signups.
    console.error("[auth] verification email failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Login / logout
// ---------------------------------------------------------------------------

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rl = await checkRateLimit("auth_login", 10, 60000);
  if (!rl.success) return { error: "Too many login attempts. Please wait a minute." };

  const parsed = LoginSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: CREDENTIALS_REJECTED };
  const { email, password } = parsed.data;
  const next = String(formData.get("next") ?? "/account");

  const user = await queryOne<{
    id: string;
    password_hash: string | null;
    email_verified_at: Date | null;
  }>(
    `select id, password_hash, email_verified_at from users where lower(email) = lower($1)`,
    [email],
  );

  if (!user?.password_hash) {
    // Spend comparable time so a missing account is not detectable by timing.
    await dummyVerify(password);
    return { error: CREDENTIALS_REJECTED };
  }

  if (!(await verifyPassword(password, user.password_hash))) {
    return { error: CREDENTIALS_REJECTED };
  }

  if (!user.email_verified_at) {
    return { pendingConfirmation: true, email };
  }

  await createSession(user.id, await requestMeta());
  revalidatePath("/", "layout");
  redirect(safeRedirectPath(next));
}

export async function logoutAction() {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendConfirmationAction(email: string): Promise<AuthState> {
  const rl = await checkRateLimit("auth_resend", 3, 300000);
  if (!rl.success) return { error: "Too many resend requests. Please wait 5 minutes." };
  if (!email) return { error: "Email required." };

  const user = await queryOne<{ id: string; email_verified_at: Date | null }>(
    `select id, email_verified_at from users where lower(email) = lower($1)`,
    [email],
  );
  if (user && !user.email_verified_at) {
    await sendVerification(user.id, email);
  }
  // Same response either way — this endpoint must not report who is registered.
  return { pendingConfirmation: true, email };
}

// ---------------------------------------------------------------------------
// Password reset
// ---------------------------------------------------------------------------

export async function forgotPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const rl = await checkRateLimit("auth_forgot", 3, 300000);
  if (!rl.success) return { error: "Too many password reset requests. Please wait 5 minutes." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  const user = await queryOne<{ id: string }>(
    `select id from users where lower(email) = lower($1)`,
    [email],
  );
  if (user) {
    const token = await issueToken("reset", user.id);
    try {
      await sendPasswordResetEmail(email, await siteOrigin(), token);
    } catch (err) {
      console.error("[auth] password reset email failed:", err);
    }
  }
  // Always report success: whether an address is registered is not public.
  return { success: true };
}

export async function resetPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const rl = await checkRateLimit("auth_reset", 5, 60000);
  if (!rl.success) return { error: "Too many reset attempts. Please wait a minute." };

  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!token) return { error: "This reset link is invalid. Please request a new one." };
  if (!password) return { error: "Please enter a new password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const userId = await consumeToken("reset", token);
  if (!userId) {
    return { error: "This reset link has expired or already been used. Please request a new one." };
  }

  const passwordHash = await hashPassword(password);
  await query(
    `update users
        set password_hash = $1,
            -- Reaching the inbox proves the address; a pending signup is now verified.
            email_verified_at = coalesce(email_verified_at, now())
      where id = $2`,
    [passwordHash, userId],
  );
  // Anyone holding a stolen session for this account loses it.
  await destroyAllSessionsForUser(userId);

  revalidatePath("/", "layout");
  redirect("/login?error=Password%20reset%20successfully.%20Please%20sign%20in%20with%20your%20new%20password.");
}
