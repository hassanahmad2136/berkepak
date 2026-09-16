import nodemailer from "nodemailer";

/**
 * Shared SMTP transport. Built lazily: constructing it at module load meant an
 * unset SMTP_HOST produced a broken transport at import time, and local Mailpit
 * (port 1025, no auth) could not be used at all.
 */
let transporter: nodemailer.Transporter | null = null;

export function isSmtpConfigured(): boolean {
  return !!process.env.SMTP_HOST;
}

function getTransport(): nodemailer.Transporter {
  if (transporter) return transporter;

  const port = Number(process.env.SMTP_PORT ?? 465);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // Mailpit and other local catchers advertise no AUTH; offering credentials
    // to them fails the handshake.
    auth: user && pass ? { user, pass } : undefined,
  });
  return transporter;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error("[email] SMTP_HOST is not set — cannot send mail.");
  }
  await getTransport().sendMail({
    from: `"Berke Pak" <${process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@berkepakfabrics.com"}>`,
    to,
    subject,
    html,
    text: text ?? html.replace(/<[^>]+>/g, ""),
  });
}
