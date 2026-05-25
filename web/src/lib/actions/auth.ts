"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeRedirectPath } from "@/lib/utils/redirect";
import { checkRateLimit } from "@/lib/rate-limit";
import { SignupSchema, LoginSchema } from "@/lib/validation";

export type AuthState =
  | undefined
  | { error: string }
  | { pendingConfirmation: true; email: string };

const PK_MOBILE_RE = /^(?:\+92|0)3\d{9}$/;

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

export async function signupAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rl = await checkRateLimit("auth_signup", 5, 60000);
  if (!rl.success) return { error: "Too many signup attempts. Please wait a minute." };

  const raw = {
    fullName: String(formData.get("fullName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
    phone: normalizePhone(String(formData.get("phone") ?? "").trim()),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const { fullName, email, phone, password } = parsed.data;

  const origin = await siteOrigin();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
      emailRedirectTo: `${origin}/auth/callback?next=/account`,
    },
  });
  if (error) return { error: error.message };

  // If a session is returned immediately, email confirmation is disabled in
  // the Supabase project — go straight to the account.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/account");
  }

  // Otherwise the user must click the confirmation link in their inbox first.
  return { pendingConfirmation: true, email };
}

export async function loginAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const rl = await checkRateLimit("auth_login", 10, 60000);
  if (!rl.success) return { error: "Too many login attempts. Please wait a minute." };

  const raw = {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email or password format." };
  }
  const { email, password } = parsed.data;
  const next = String(formData.get("next") ?? "/account");

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(next));
}

export async function logoutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendConfirmationAction(email: string): Promise<AuthState> {
  const rl = await checkRateLimit("auth_resend", 3, 300000);
  if (!rl.success) return { error: "Too many resend requests. Please wait 5 minutes." };
  if (!email) return { error: "Email required." };
  const origin = await siteOrigin();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/account` },
  });
  if (error) return { error: error.message };
  return { pendingConfirmation: true, email };
}

export async function forgotPasswordAction(
  _prev: any,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const rl = await checkRateLimit("auth_forgot", 3, 300000);
  if (!rl.success) return { error: "Too many password reset requests. Please wait 5 minutes." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  try {
    const origin = await siteOrigin();
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/reset-password`,
    });
    if (error) return { error: error.message };
    return { success: true };
  } catch (err: any) {
    return { error: err.message || "An unexpected error occurred." };
  }
}

export async function resetPasswordAction(
  _prev: any,
  formData: FormData,
): Promise<{ success?: boolean; error?: string }> {
  const rl = await checkRateLimit("auth_reset", 5, 60000);
  if (!rl.success) return { error: "Too many reset attempts. Please wait a minute." };
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password) return { error: "Please enter a new password." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  try {
    const supabase = await createSupabaseServer();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
  } catch (err: any) {
    return { error: err.message || "Failed to reset password." };
  }

  revalidatePath("/", "layout");
  redirect("/login?error=Password%20reset%20successfully.%20Please%20sign%20in%20with%20your%20new%20password.");
}
