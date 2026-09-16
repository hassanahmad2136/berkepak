"use server";

import crypto from "crypto";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { query, queryOne } from "@/lib/db";
import { checkRateLimit, checkRateLimitByKey } from "@/lib/rate-limit";

export type OtpResult = {
  ok: boolean;
  error?: string;
};

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function generateSecureCode(): string {
  // Generate a cryptographically secure random number between 1000 and 9999
  return String(crypto.randomInt(1000, 10000));
}

async function generateUniqueSecureCode(): Promise<string> {
  let code = "";
  let isUnique = false;
  let attempts = 0;

  while (!isUnique && attempts < 10) {
    code = generateSecureCode();
    attempts++;

    // Reject a code that is already live for someone else.
    const clash = await queryOne(
      `select id from otp_codes
        where code = $1 and consumed_at is null and expires_at > now() limit 1`,
      [code],
    );
    if (!clash) isUnique = true;
  }

  // Fallback to secure code if we hit retry limits (extremely unlikely)
  if (!isUnique) {
    code = generateSecureCode();
  }

  return code;
}

export async function sendOtp(
  target: string,
  method: "whatsapp" | "email",
): Promise<OtpResult> {
  // Per-target rate limit: max 3 OTPs per target per window, keyed by target only (no IP suffix)
  // so rotating IPs cannot bypass the limit for a given victim phone/email.
  const targetRateLimit = await checkRateLimitByKey(`otp_send:${target}`, 3);
  if (!targetRateLimit.success) {
    return { ok: false, error: targetRateLimit.error ?? "Too many OTP requests. Please wait before trying again." };
  }

  // Global IP-based rate limit
  const rateLimit = await checkRateLimit("otp_send", 5);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error };
  }

  if (method === "email") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      return { ok: false, error: "Invalid email address." };
    }
  } else {
    if (!/^\+?\d{7,15}$/.test(target.replace(/[\s-]/g, ""))) {
      return { ok: false, error: "Invalid phone number." };
    }
  }

  const code = await generateUniqueSecureCode();
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000);

  // Column is `destination` in the self-hosted schema — it holds an email
  // address as often as a phone number.
  await query(
    `insert into otp_codes (destination, code, channel, expires_at) values ($1, $2, $3, $4)`,
    [target, code, method === "email" ? "email" : "whatsapp", expires],
  );

  let liveSent = false;
  let liveError = "";
  let deliveryWasExpected = false;

  if (method === "email") {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 465);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    const isSmtpConfigured =
      smtpHost &&
      smtpUser &&
      smtpPass &&
      smtpPass !== "REPLACE_WITH_YOUR_EMAIL_PASSWORD" &&
      smtpPass.trim() !== "";

    if (isSmtpConfigured) {
      deliveryWasExpected = true;
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465, // true for port 465 SSL, false for others
          auth: {
            user: smtpUser,
            pass: smtpPass,
          },
        });

        await transporter.sendMail({
          from: `"BerkePak Fabrics" <${smtpUser}>`,
          to: target,
          subject: "🔐 Your BerkePak Verification Code",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; padding: 40px 20px; background-color: #fafaf9; color: #1c1917; min-height: 100%; box-sizing: border-box;">
              <div style="max-width: 560px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e7e5e4; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);">
                
                <!-- Header / Logo -->
                <div style="text-align: center; margin-bottom: 32px;">
                  <h1 style="font-size: 24px; font-weight: 700; letter-spacing: -0.025em; margin: 0; color: #1c1917; text-transform: uppercase;">
                    BerkePak Fabrics
                  </h1>
                  <p style="font-size: 13px; color: #78716c; margin-top: 4px; letter-spacing: 0.05em; text-transform: uppercase;">
                    Premium Quality Textiles
                  </p>
                </div>

                <!-- Divider -->
                <div style="height: 1px; background-color: #f5f5f4; margin-bottom: 32px;"></div>

                <!-- Body -->
                <p style="font-size: 15px; line-height: 24px; color: #44403c; margin: 0 0 16px 0;">
                  Hello,
                </p>
                <p style="font-size: 15px; line-height: 24px; color: #44403c; margin: 0 0 24px 0;">
                  Thank you for placing your order with BerkePak Fabrics. To complete your Cash on Delivery (COD) verification, please use the 4-digit code below:
                </p>

                <!-- Code Block Container -->
                <div style="text-align: center; margin: 32px 0;">
                  <div style="display: inline-block; padding: 16px 36px; font-size: 32px; font-weight: 700; letter-spacing: 6px; background-color: #f5f5f4; border: 1px solid #e7e5e4; color: #1c1917; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;">
                    ${code}
                  </div>
                  <p style="font-size: 13px; color: #78716c; margin-top: 12px; margin-bottom: 0;">
                    Code is active for <strong>${OTP_TTL_MINUTES} minutes</strong>
                  </p>
                </div>

                <p style="font-size: 14px; line-height: 22px; color: #78716c; margin: 24px 0 0 0;">
                  If you did not make this request, you can safely ignore this email. Your order will not be processed until it is verified.
                </p>

                <!-- Divider -->
                <div style="height: 1px; background-color: #f5f5f4; margin: 32px 0;"></div>

                <!-- Footer -->
                <div style="text-align: center;">
                  <p style="font-size: 12px; color: #a8a29e; margin: 0;">
                    &copy; ${new Date().getFullYear()} BerkePak Fabrics. All rights reserved.
                  </p>
                  <p style="font-size: 11px; color: #d6d3d1; margin-top: 4px;">
                    This is an automated transactional message. Please do not reply directly to this email.
                  </p>
                </div>

              </div>
            </div>
          `,
        });
        liveSent = true;
        // eslint-disable-next-line no-console
        console.log(`[Email OTP] Live email successfully dispatched via SMTP to ${target}`);
      } catch (err: any) {
        liveError = err.message || String(err);
        // eslint-disable-next-line no-console
        console.error(`[Email OTP] Live SMTP delivery failed: ${liveError}`);
      }
    }
  } else if (method === "whatsapp") {
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

    const isTwilioConfigured =
      twilioSid &&
      twilioToken &&
      twilioSid !== "REPLACE_WITH_TWILIO_ACCOUNT_SID" &&
      twilioSid.trim() !== "";

    if (isTwilioConfigured) {
      deliveryWasExpected = true;
      try {
        const client = twilio(twilioSid, twilioToken);
        await client.messages.create({
          from: twilioFrom,
          to: `whatsapp:${target}`,
          body: `🔒 BerkePak Fabrics Order Verification\n\nYour 4-digit verification code is: ${code}\n\nThis code expires in 10 minutes. Please enter it on the checkout page to confirm your COD order.`,
        });
        liveSent = true;
        // eslint-disable-next-line no-console
        console.log(`[WhatsApp OTP] Live WhatsApp message successfully dispatched to ${target}`);
      } catch (err: any) {
        liveError = err.message || String(err);
        // eslint-disable-next-line no-console
        console.error(`[WhatsApp OTP] Live Twilio delivery failed: ${liveError}`);
      }
    }
  }

  // Fallback / simulation logging if not live sent or if delivery errored
  if (!liveSent) {
    if (liveError) {
      // eslint-disable-next-line no-console
      console.log(`[OTP Fallback] Using simulation due to delivery failure: ${liveError}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[OTP Simulation] Credentials not set. Simulation mode active.`);
    }

    if (method === "email") {
      // eslint-disable-next-line no-console
      console.log(`[Email OTP Simulation] Code: ${code} | Target: ${target} | Expires: ${expires.toISOString()}`);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[WhatsApp OTP Simulation] Code: ${code} | Target: ${target} | Expires: ${expires.toISOString()}`);
    }
  }

  // If delivery was expected (credentials configured) but failed, return an error.
  // The OTP code is still logged server-side for developers to use in dev environments.
  if (deliveryWasExpected && !liveSent) {
    return { ok: false, error: `Delivery failed: ${liveError}. Check your details and try again.` };
  }

  return { ok: true };
}

export async function verifyOtp(
  target: string,
  code: string,
): Promise<OtpResult> {
  const rateLimit = await checkRateLimit("otp_verify", 10);
  if (!rateLimit.success) {
    return { ok: false, error: rateLimit.error };
  }

  const row = await queryOne<{
    id: string;
    code: string;
    attempts: number;
    expires_at: Date;
    consumed_at: Date | null;
  }>(
    `select id, code, attempts, expires_at, consumed_at
       from otp_codes
      where destination = $1
      order by created_at desc
      limit 1`,
    [target],
  );
  if (!row) return { ok: false, error: "No code requested for this number." };
  if (row.consumed_at) return { ok: false, error: "Code already used." };
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, error: "Code expired. Request a new one." };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    return { ok: false, error: "Too many attempts. Request a new code." };
  }

  if (row.code !== code) {
    await query(`update otp_codes set attempts = attempts + 1 where id = $1`, [row.id]);
    return { ok: false, error: "Incorrect code." };
  }

  await query(`update otp_codes set consumed_at = now() where id = $1`, [row.id]);
  return { ok: true };
}
