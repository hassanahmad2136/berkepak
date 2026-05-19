"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServer } from "@/lib/supabase/server";

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
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").trim();
  const phone = normalizePhone(phoneRaw);
  const password = String(formData.get("password") ?? "");

  if (!fullName) return { error: "Please enter your full name." };
  if (!email) return { error: "Please enter your email." };
  if (!phone) return { error: "Mobile number is required." };
  if (!PK_MOBILE_RE.test(phone)) {
    return {
      error:
        "Enter a valid Pakistani mobile number (e.g. 03001234567 or +923001234567).",
    };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/account");

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(next);
}

export async function logoutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

export async function resendConfirmationAction(email: string): Promise<AuthState> {
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
