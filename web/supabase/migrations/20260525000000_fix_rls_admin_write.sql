-- Fix: product_catalog admin_write policy granted write access to ALL
-- authenticated users (auth.role() = 'authenticated').
-- Any shopper could set price_per_suit = 0 via Supabase SDK.
-- Replace with admin-only check via admin_users lookup table.

-- Drop the unsafe policy
DROP POLICY IF EXISTS admin_write ON product_catalog;

-- Create admin_users table (idempotent)
CREATE TABLE IF NOT EXISTS admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lock down admin_users to direct client access.
-- Supabase service_role has BYPASSRLS privilege and ignores these policies,
-- so createSupabaseAdmin() (service_role) can still INSERT/DELETE admin users.
-- This policy blocks anon + authenticated roles from reading or writing admin_users.
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_users_service_only ON admin_users;
CREATE POLICY admin_users_service_only ON admin_users
  USING (false)
  WITH CHECK (false);

-- New write policy: only users listed in admin_users can mutate product_catalog
DROP POLICY IF EXISTS admin_write_safe ON product_catalog;
CREATE POLICY admin_write_safe ON product_catalog
  FOR ALL
  USING (
    auth.uid() IN (SELECT user_id FROM admin_users)
  )
  WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_users)
  );

-- Seed admin_users in Supabase SQL editor after applying this migration:
-- SELECT id, email FROM auth.users WHERE email = 'your-admin@example.com';
-- INSERT INTO admin_users (user_id) VALUES ('<UUID>') ON CONFLICT DO NOTHING;
