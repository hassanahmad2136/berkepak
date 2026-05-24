-- =====================================================================
-- Berke Pak Fabrics — Product Details and Synchronization Expansion
-- =====================================================================

-- Alter products table to store all detailed fields from Saleor
alter table public.products add column if not exists price_per_meter numeric;
alter table public.products add column if not exists category text;
alter table public.products add column if not exists weave text;
alter table public.products add column if not exists gsm integer;
alter table public.products add column if not exists thread_count integer;
alter table public.products add column if not exists composition text;
alter table public.products add column if not exists color_name text;
alter table public.products add column if not exists color_hex text;
alter table public.products add column if not exists meters_per_suit numeric;
alter table public.products add column if not exists images text[];
alter table public.products add column if not exists short_description text;
alter table public.products add column if not exists description text;
alter table public.products add column if not exists is_new boolean default false;
alter table public.products add column if not exists is_featured boolean default false;
alter table public.products add column if not exists available boolean default true;
alter table public.products add column if not exists suit_variant_id text;
alter table public.products add column if not exists meter_variant_id text;
alter table public.products add column if not exists sku text;

-- Clean up old incorrect Variant ID based records
delete from public.product_colors where product_id like 'ProductVariant:%';
delete from public.products where id like 'ProductVariant:%';

