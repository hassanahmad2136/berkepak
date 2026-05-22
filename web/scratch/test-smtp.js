const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

// Load variables from .env.local manually for the script
const envPath = path.join(__dirname, "../.env.local");
let env = {};

if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      let value = match[2] || "";
      if (value.startsWith("'") || value.startsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      env[match[1]] = value;
    }
  });
}

const smtpHost = env.SMTP_HOST || "mail.berkepakfabrics.com";
const smtpPort = Number(env.SMTP_PORT || 465);
const smtpUser = env.SMTP_USER || "info@berkepakfabrics.com";
const smtpPass = env.SMTP_PASS;
const targetEmail = env.ADMIN_EMAILS || "abdullahahmaddd789@gmail.com";

console.log("==========================================");
console.log("   cPanel Secure SMTP Connection Diagnostic");
console.log("==========================================");
console.log(`SMTP Host:    ${smtpHost}`);
console.log(`SMTP Port:    ${smtpPort}`);
console.log(`SMTP User:    ${smtpUser}`);
console.log(`Recipient:    ${targetEmail}`);
console.log("------------------------------------------");

if (!smtpPass || smtpPass === "REPLACE_WITH_YOUR_EMAIL_PASSWORD") {
  console.error("❌ ERROR: You have not configured your email password in .env.local yet!");
  console.error("Please replace 'REPLACE_WITH_YOUR_EMAIL_PASSWORD' on line 15 with your real email password.");
  process.exit(1);
}

console.log("⏳ Attempting to connect to cPanel SMTP server and send a test verification email...");

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

transporter.sendMail({
  from: `"BerkePak Fabrics" <${smtpUser}>`,
  to: targetEmail,
  subject: "🔐 Secure SMTP Diagnostic Verification Test",
  html: `
    <div style="font-family: sans-serif; padding: 24px; color: #1c1917; max-width: 500px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 8px;">
      <h2 style="font-size: 18px; font-weight: bold; margin-bottom: 16px;">BerkePak Fabrics</h2>
      <p style="font-size: 14px; color: #44403c; line-height: 1.5;">This is a secure connection test email dispatched by your SMTP diagnostic utility.</p>
      <div style="display: inline-block; padding: 12px 24px; font-size: 20px; font-weight: bold; letter-spacing: 4px; background-color: #f5f5f4; border: 1px solid #e7e5e4; margin: 16px 0; border-radius: 4px; color: #15803d;">
        PASS
      </div>
      <p style="font-size: 12px; color: #78716c; margin-top: 16px;">Connection handshake, authentication, and dispatch succeeded perfectly!</p>
    </div>
  `
})
.then((info) => {
  console.log("\n🎉 SUCCESS! Your cPanel SMTP configuration is 100% correct!");
  console.log(`Message successfully sent. MessageId: ${info.messageId}`);
  console.log(`Please check the inbox of ${targetEmail} for the test email!`);
})
.catch((err) => {
  console.error("\n❌ SMTP CONNECTION FAILED!");
  console.error("Details:", err.message);
  console.error("\nTips to resolve:");
  console.error("1. Double-check your password in .env.local.");
  console.error("2. Ensure your domain's DNS is propagating and 'mail.berkepakfabrics.com' resolves.");
  console.error("3. If port 465 is blocked by your current server environment, try SMTP Port 587 (STARTTLS).");
});
