/**
 * Seeds admin_users table with the designated admin email.
 * Reads NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
 *
 * Usage: npm run seed
 *
 * WARNING: .env.local points to the REMOTE Supabase project.
 * This script WILL affect the live database.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminEmail = process.env.ADMIN_EMAILS?.split(",")[0]?.trim();

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
if (!adminEmail) {
  console.error("Missing ADMIN_EMAILS in .env.local");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

console.log(`Seeding admin: ${adminEmail} → ${url}`);

// Look up the user UUID by email via admin auth API
const { data: listData, error: listErr } = await admin.auth.admin.listUsers();
if (listErr) {
  console.error("Failed to list users:", listErr.message);
  process.exit(1);
}

const user = listData.users.find((u) => u.email === adminEmail);
if (!user) {
  console.error(`User ${adminEmail} not found in auth.users. Create the account first, then re-run.`);
  process.exit(1);
}

const { error: insertErr } = await admin
  .from("admin_users")
  .upsert({ user_id: user.id }, { onConflict: "user_id" });

if (insertErr) {
  console.error("Insert failed:", insertErr.message);
  process.exit(1);
}

console.log(`✓ ${adminEmail} (${user.id}) is now an admin.`);
