-- =====================================================================
-- Berke Pak — Admin User Seeding Script
-- =====================================================================
-- This script seeds admin users into the admin_users table.
-- Run this in the Supabase SQL editor AFTER applying all migrations.
--
-- The admin_users table is used by RLS policies to grant write access
-- to sensitive operations (product catalog, campaigns, promotions,
-- product images) only to designated admin users.
--
-- SETUP INSTRUCTIONS:
-- 1. Apply all migrations (including 20260614000000_fix_rls_write_policies.sql)
-- 2. Create a user in Supabase Auth with email: abdullahahmaddd789@gmail.com
-- 3. Run this script in the Supabase SQL editor
-- 4. Verify the results with the SELECT at the bottom
-- =====================================================================

-- Insert the primary admin user
INSERT INTO public.admin_users (user_id)
SELECT id FROM auth.users WHERE email = 'abdullahahmaddd789@gmail.com'
ON CONFLICT DO NOTHING;

-- Verify the results
SELECT u.email, a.created_at as admin_since
FROM public.admin_users a
JOIN auth.users u ON u.id = a.user_id
ORDER BY a.created_at DESC;

-- =====================================================================
-- NOTES FOR FUTURE ADMINS:
-- =====================================================================
-- To add a new admin user:
-- 1. Create the user in Supabase Auth (they must exist first)
-- 2. Find their UUID: SELECT id, email FROM auth.users WHERE email = 'newadmin@example.com';
-- 3. Insert into admin_users:
--    INSERT INTO public.admin_users (user_id) VALUES ('<UUID>') ON CONFLICT DO NOTHING;
--
-- To remove an admin user:
-- DELETE FROM public.admin_users WHERE user_id = (SELECT id FROM auth.users WHERE email = 'admin@example.com');
--
-- To list all admins:
-- SELECT u.email, a.created_at as admin_since FROM public.admin_users a
-- JOIN auth.users u ON u.id = a.user_id ORDER BY a.created_at DESC;
-- =====================================================================
