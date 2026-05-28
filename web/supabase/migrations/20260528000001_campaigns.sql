-- =====================================================================
-- Berke Pak — Campaigns: automatic product-level discount system
-- Separate from promotions (banners/coupons). Campaigns apply at
-- product display time; highest-priority campaign wins per product.
-- =====================================================================

create table if not exists public.campaigns (
  id               uuid        primary key default gen_random_uuid(),
  name             text        not null,
  discount_type    text        not null check (discount_type in ('pct', 'fixed')),
  discount_value   numeric(10, 2) not null check (discount_value > 0),
  scope            text        not null check (scope in ('all', 'categories', 'products')),
  category_targets text[]      not null default '{}',
  product_targets  uuid[]      not null default '{}',
  priority         integer     not null default 0,
  is_active        boolean     not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

alter table public.campaigns enable row level security;

-- Storefront: read active campaigns via anon key
drop policy if exists "campaigns_public_read" on public.campaigns;
create policy "campaigns_public_read"
  on public.campaigns for select
  using (is_active = true);

-- Admin: authenticated can manage all (real authz enforced in server actions)
drop policy if exists "campaigns_admin_all" on public.campaigns;
create policy "campaigns_admin_all"
  on public.campaigns for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Performance: filter by is_active + scope
create index if not exists idx_campaigns_is_active on public.campaigns(is_active);
create index if not exists idx_campaigns_priority on public.campaigns(priority desc, created_at desc);
