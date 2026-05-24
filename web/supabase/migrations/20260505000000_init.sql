-- =====================================================================
-- Berke Pak Fabrics — initial schema
-- =====================================================================

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- measurement profile (Phase 5: bespoke stitching) ----------
create table public.measurements (
  user_id uuid primary key references auth.users on delete cascade,
  chest numeric,
  shoulder numeric,
  length numeric,
  sleeve numeric,
  neck numeric,
  waist numeric,
  updated_at timestamptz default now()
);

-- ---------- addresses ----------
create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  label text,
  full_name text not null,
  phone text not null,
  line1 text not null,
  line2 text,
  city text not null,
  province text not null,
  postal_code text not null,
  country text not null default 'Pakistan',
  is_default boolean default false,
  created_at timestamptz default now()
);
create index addresses_user_idx on public.addresses(user_id);

-- ---------- orders ----------
-- status:         unconfirmed | confirmed | fulfilled | shipped | delivered | cancelled
-- payment_status: pending | awaiting_receipt | awaiting_review | approved | paid | refunded
create table public.orders (
  id text primary key,
  user_id uuid references auth.users on delete set null,
  status text not null default 'unconfirmed',
  payment_method text not null check (payment_method in ('cod','bank_transfer')),
  payment_status text not null default 'pending',
  subtotal numeric not null,
  shipping numeric not null default 0,
  total numeric not null,
  shipping_address jsonb not null,
  otp_verified boolean default false,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index orders_user_idx on public.orders(user_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders on delete cascade,
  product_id text not null,
  product_name text not null,
  product_slug text not null,
  unit text not null check (unit in ('meter','suit')),
  quantity numeric not null,
  unit_price numeric not null,
  line_total numeric not null
);
create index order_items_order_idx on public.order_items(order_id);

-- ---------- receipts (bank transfer manual verification) ----------
create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  notes text,
  created_at timestamptz default now()
);
create index receipts_user_idx on public.receipts(user_id);
create index receipts_order_idx on public.receipts(order_id);

-- ---------- wishlist ----------
create table public.wishlist (
  user_id uuid not null references auth.users on delete cascade,
  product_id text not null,
  created_at timestamptz default now(),
  primary key (user_id, product_id)
);

-- ---------- otp codes (for COD pre-verification) ----------
create table public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code text not null,
  attempts int not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz default now()
);
create index otp_phone_idx on public.otp_codes(phone, created_at desc);

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles      enable row level security;
alter table public.measurements  enable row level security;
alter table public.addresses     enable row level security;
alter table public.orders        enable row level security;
alter table public.order_items   enable row level security;
alter table public.receipts      enable row level security;
alter table public.wishlist      enable row level security;
alter table public.otp_codes     enable row level security;

-- profiles
create policy "profiles_self_read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_self_update" on public.profiles for update using (auth.uid() = id);

-- measurements
create policy "measurements_self_all" on public.measurements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- addresses
create policy "addresses_self_all" on public.addresses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- orders
create policy "orders_self_read"   on public.orders for select using (auth.uid() = user_id);
create policy "orders_self_insert" on public.orders for insert with check (auth.uid() = user_id);
create policy "orders_self_update" on public.orders for update using (auth.uid() = user_id);

-- order_items
create policy "order_items_self_read" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);
create policy "order_items_self_insert" on public.order_items for insert with check (
  exists (select 1 from public.orders o where o.id = order_items.order_id and o.user_id = auth.uid())
);

-- receipts
create policy "receipts_self_read"   on public.receipts for select using (auth.uid() = user_id);
create policy "receipts_self_insert" on public.receipts for insert with check (auth.uid() = user_id);

-- wishlist
create policy "wishlist_self_all" on public.wishlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- otp_codes — written/read only via service role from server actions; deny all to anon/auth
create policy "otp_no_client_access" on public.otp_codes for all using (false);

-- =====================================================================
-- Storage bucket for receipts
-- =====================================================================
insert into storage.buckets (id, name)
values ('receipts', 'receipts')
on conflict (id) do nothing;

create policy "receipts_self_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "receipts_self_read"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- Profile auto-creation trigger
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'phone', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Updated_at trigger helper
-- =====================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch     before update on public.profiles     for each row execute function public.touch_updated_at();
create trigger measurements_touch before update on public.measurements for each row execute function public.touch_updated_at();
create trigger orders_touch       before update on public.orders       for each row execute function public.touch_updated_at();
