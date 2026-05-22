-- =====================================================================
-- Berke Pak Fabrics — Products pricing table
-- =====================================================================

create table if not exists public.products (
  id text primary key, -- Saleor product variant ID
  slug text not null unique,
  name text not null,
  price_per_suit numeric not null,
  updated_at timestamptz default now()
);

-- Enable Row Level Security (RLS)
alter table public.products enable row level security;

-- Drop existing policies if they exist (to avoid conflicts)
drop policy if exists "products_public_read" on public.products;

-- Create policy: allow anyone to select/read the products and prices
create policy "products_public_read"
  on public.products for select
  using (true);

-- Note: Admin operations (updates/inserts) will be performed via the
-- Supabase service role client (bypassing RLS), so no explicit write policy
-- is needed for client roles. This is highly secure.

-- Create touch_updated_at trigger for products table
drop trigger if exists products_touch on public.products;
create trigger products_touch
  before update on public.products
  for each row execute function public.touch_updated_at();
