-- =====================================================================
-- Berke Pak — Promotions system + product-images storage bucket
-- =====================================================================

-- 1. Promotions table
create table if not exists public.promotions (
  id               uuid        primary key default gen_random_uuid(),
  type             text        not null check (type in ('banner', 'coupon')),
  title            text        not null,
  body             text,
  code             text        unique,
  discount_type    text        check (discount_type in ('pct', 'fixed')),
  discount_value   numeric(10, 2),
  min_order_amount numeric(10, 2) not null default 0,
  is_active        boolean     not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

-- 2. Add discount columns to orders
alter table public.orders
  add column if not exists discount_amount numeric(10, 2) not null default 0,
  add column if not exists promo_id        uuid references public.promotions(id);

-- 3. RLS on promotions
alter table public.promotions enable row level security;

-- Public: anyone can read active promotions (needed for homepage popup server fetch)
create policy "promotions_public_read"
  on public.promotions for select
  using (is_active = true);

-- Admin: authenticated users can do everything (RLS for write is enforced via requireAdmin() in server actions)
create policy "promotions_admin_all"
  on public.promotions for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 4. product-images storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,  -- 5MB limit
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Storage policies for product-images
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "product_images_auth_upload"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and auth.role() = 'authenticated');

create policy "product_images_auth_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and auth.role() = 'authenticated');
