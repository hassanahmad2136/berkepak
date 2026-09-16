import "server-only";
import { sendEmail } from "@/lib/email";

/**
 * Transactional auth email. Supabase used to send these; self-hosted they run
 * through our own SMTP (Mailpit locally, real SMTP in production).
 */

function shell(heading: string, body: string, cta: { href: string; label: string }): string {
  return `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#fafaf9;padding:40px 20px;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:12px;padding:40px;">
      <div style="text-align:center;margin-bottom:32px;">
        <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin:0;text-transform:uppercase;">Berke Pak Fabrics</h1>
        <p style="font-size:12px;color:#78716c;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase;">Unstitched shalwar kameez fabric</p>
      </div>
      <h2 style="font-size:18px;margin:0 0 16px;">${heading}</h2>
      <p style="font-size:15px;line-height:24px;color:#44403c;margin:0 0 28px;">${body}</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${cta.href}" style="display:inline-block;background:#1c1917;color:#fff;text-decoration:none;padding:14px 28px;border-radius:8px;font-size:14px;font-weight:600;">${cta.label}</a>
      </div>
      <p style="font-size:13px;line-height:20px;color:#78716c;margin:0;">
        If the button does not work, paste this into your browser:<br>
        <span style="word-break:break-all;color:#57534e;">${cta.href}</span>
      </p>
      <div style="height:1px;background:#f5f5f4;margin:32px 0;"></div>
      <p style="font-size:12px;color:#a8a29e;margin:0;text-align:center;">
        &copy; ${new Date().getFullYear()} Berke Pak Fabrics. This is an automated message.
      </p>
    </div>
  </div>`;
}

export async function sendVerificationEmail(to: string, origin: string, token: string) {
  const href = `${origin}/auth/verify?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Confirm your Berke Pak account",
    html: shell(
      "Confirm your email address",
      "You are one click away from finishing your Berke Pak account. This link is valid for 24 hours and can be used once.",
      { href, label: "Confirm email" },
    ),
  });
}

export async function sendPasswordResetEmail(to: string, origin: string, token: string) {
  const href = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to,
    subject: "Reset your Berke Pak password",
    html: shell(
      "Reset your password",
      "Use the link below to choose a new password. It is valid for one hour and can be used once. If you did not request this, you can safely ignore this email — your password will not change.",
      { href, label: "Choose a new password" },
    ),
  });
}
