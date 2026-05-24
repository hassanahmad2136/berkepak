-- =====================================================================
-- Berke Pak — product_catalog: replaces Saleor product layer
-- =====================================================================

-- 1. Create product_catalog table
create table if not exists public.product_catalog (
  id                uuid        primary key default gen_random_uuid(),
  slug              text        not null unique,
  name              text        not null,
  category          text        not null,
  weave_type        text,
  gsm               integer,
  thread_count      integer,
  composition       text,
  description       text        default '',
  short_description text        default '',
  price_per_meter   numeric     not null default 0,
  price_per_suit    numeric     not null default 0,
  meters_per_suit   numeric     not null default 2.75,
  images            text[]      not null default '{}',
  is_new            boolean     not null default false,
  is_featured       boolean     not null default false,
  is_active         boolean     not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- 2. Enable RLS
alter table public.product_catalog enable row level security;

-- 3. Public read: only active products
create policy "public_read_active" on public.product_catalog
  for select using (is_active = true);

-- 4. Admin write: authenticated users
create policy "admin_write" on public.product_catalog
  for all using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- 5. updated_at trigger (requires moddatetime extension)
create extension if not exists moddatetime schema extensions;
create trigger set_updated_at
  before update on public.product_catalog
  for each row execute function moddatetime(updated_at);

-- 6. Index is_active for RLS filter performance
create index if not exists idx_product_catalog_is_active on public.product_catalog(is_active);

-- 7. Add catalog_id UUID column to product_colors (populate later in porting script)
alter table public.product_colors
  add column if not exists catalog_id uuid;
