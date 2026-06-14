-- =====================================================================
-- Fix RLS: Restrict write access to admin-only for promotions,
-- campaigns, and product-images storage bucket.
-- =====================================================================

-- 1. FIX: promotions table
-- Replace unsafe "promotions_admin_all" (allowed any authenticated user)
-- with admin_users-based check.
DROP POLICY IF EXISTS "promotions_admin_all" ON public.promotions;

CREATE POLICY "promotions_admin_write"
  ON public.promotions FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- 2. FIX: campaigns table
-- Replace unsafe "campaigns_admin_all" (allowed any authenticated user)
-- with admin_users-based check.
DROP POLICY IF EXISTS "campaigns_admin_all" ON public.campaigns;

CREATE POLICY "campaigns_admin_write"
  ON public.campaigns FOR ALL
  USING (auth.uid() IN (SELECT user_id FROM admin_users))
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));

-- 3. FIX: product-images storage bucket
-- Replace unsafe upload/delete policies (allowed any authenticated user)
-- with admin_users-based checks.
DROP POLICY IF EXISTS "product_images_auth_upload" ON storage.objects;

CREATE POLICY "product_images_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IN (SELECT user_id FROM admin_users));

DROP POLICY IF EXISTS "product_images_auth_delete" ON storage.objects;

CREATE POLICY "product_images_admin_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() IN (SELECT user_id FROM admin_users));
