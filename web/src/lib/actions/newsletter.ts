"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import nodemailer from "nodemailer";

export async function subscribeToNewsletter(email: string): Promise<{ ok: boolean; error?: string }> {
  if (!email || !email.trim()) return { ok: false, error: "Email is required." };
  const normalized = email.trim().toLowerCase();

  try {
    const admin = createSupabaseAdmin();
    
    // 1. Try to save in Supabase
    try {
      const { error } = await admin
        .from("newsletter_subscribers")
        .insert({ email: normalized });
      
      // If table doesn't exist yet, PostgREST will throw a PGRST205 error
      if (error && error.code !== "PGRST205") {
        console.warn("Supabase save error during newsletter subscription:", error.message);
      }
    } catch (dbErr) {
      console.warn("DB save failed during newsletter subscription:", dbErr);
    }

    // 2. Dispatch a cPanel SMTP email notification to admins
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || "465");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (smtpHost && smtpUser && smtpPass) {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        tls: {
          rejectUnauthorized: false,
        },
      });

      await transporter.sendMail({
        from: `"BerkePak Fabrics" <${smtpUser}>`,
        to: "admin@berkepakfabrics.com, abdullahahmad@berkepakfabrics.com",
        subject: `🔔 New Newsletter Subscription: ${normalized}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; background-color: #fafaf9; color: #1c1917;">
            <div style="max-width: 600px; margin: 0 auto; background: #ffffff; padding: 30px; border-radius: 8px; border: 1px solid #e7e5e4;">
              <h2 style="font-size: 20px; font-weight: 700; color: #1e3a8a; margin-bottom: 20px; text-transform: uppercase; border-bottom: 2px solid #f5f5f4; padding-bottom: 10px;">
                New Newsletter Subscriber
              </h2>
              <p style="font-size: 14px; margin-bottom: 12px;">A new user has subscribed to the BerkePak Fabrics newsletter.</p>
              <div style="background-color: #f5f5f4; padding: 15px; border-radius: 6px; font-family: monospace; font-size: 14px; margin-top: 15px; border-left: 4px solid #1e3a8a;">
                <strong>Email Address:</strong> ${normalized}
              </div>
              <p style="font-size: 12px; color: #78716c; margin-top: 25px; text-align: center; border-top: 1px solid #f5f5f4; padding-top: 15px;">
                This is an automated administrative notification from BerkePak Fabrics.
              </p>
            </div>
          </div>
        `,
      });
    }

    return { ok: true };
  } catch (err: any) {
    console.error("Newsletter subscription failure:", err);
    return { ok: false, error: err.message || "Failed to subscribe." };
  }
}
