"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";

export type OtpResult = {
  ok: boolean;
  error?: string;
  /** Dev-only: OTP code returned in dev so the UI can show it. Never set in production. */
  devCode?: string;
};

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export async function sendOtp(phone: string): Promise<OtpResult> {
  if (!/^\+?\d{7,15}$/.test(phone.replace(/[\s-]/g, ""))) {
    return { ok: false, error: "Invalid phone number." };
  }
  const code = generateCode();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

  const admin = createSupabaseAdmin();
  const { error } = await admin
    .from("otp_codes")
    .insert({ phone, code, expires_at: expires });
  if (error) return { ok: false, error: error.message };

  // TODO: replace with real SMS/WhatsApp provider (Twilio, Vonage, local PK gateway)
  // For now: log to server console; expose to UI only in dev.
  // eslint-disable-next-line no-console
  console.log(`[BerkePak OTP] ${phone} -> ${code} (expires ${expires})`);

  return { ok: true, devCode: process.env.NODE_ENV !== "production" ? code : undefined };
}

export async function verifyOtp(
  phone: string,
  code: string,
): Promise<OtpResult> {
  const admin = createSupabaseAdmin();

  const { data: rows, error } = await admin
    .from("otp_codes")
    .select("id, code, attempts, expires_at, consumed_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return { ok: false, error: error.message };

  const row = rows?.[0];
  if (!row) return { ok: false, error: "No code requested for this number." };
  if (row.consumed_at) return { ok: false, error: "Code already used." };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (row.code !== code) {
    await admin
      .from("otp_codes")
      .update({ attempts: row.attempts + 1 })
      .eq("id", row.id);
    return { ok: false, error: "Incorrect code." };
  }

  await admin
    .from("otp_codes")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", row.id);
  return { ok: true };
}
