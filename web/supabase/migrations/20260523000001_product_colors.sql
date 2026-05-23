-- =====================================================================
-- Berke Pak Fabrics — Product Colors, Stock, and Image Management
-- =====================================================================

-- 1. Create product_colors table
create table if not exists public.product_colors (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  color_name text not null,
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz default now(),
  unique (product_id, color_name)
);

-- Enable RLS on product_colors
alter table public.product_colors enable row level security;

-- Drop existing public read policy if it exists
drop policy if exists "product_colors_public_read" on public.product_colors;

-- Allow anyone to select/read the product colors & stock details
create policy "product_colors_public_read"
  on public.product_colors for select
  using (true);

-- 2. Alter order_items to store color
alter table public.order_items add column if not exists color text;

-- 3. Create function and trigger to automatically seed default colors on new products
create or replace function public.handle_new_product_colors()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.product_colors (product_id, color_name, stock)
  values 
    (new.id, 'White', 10),
    (new.id, 'Black', 10)
  on conflict (product_id, color_name) do nothing;
  return new;
end;
$$;

-- Setup the trigger on insert of products
drop trigger if exists on_product_created on public.products;
create trigger on_product_created
  after insert on public.products
  for each row execute function public.handle_new_product_colors();

-- 4. Seed all existing products with White and Black colors and stock 10
insert into public.product_colors (product_id, color_name, stock)
select id, 'White', 10 from public.products
on conflict (product_id, color_name) do nothing;

insert into public.product_colors (product_id, color_name, stock)
select id, 'Black', 10 from public.products
on conflict (product_id, color_name) do nothing;

-- 5. Create public storage bucket for color-separated product images
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Drop existing storage select policy if it exists
drop policy if exists "product_images_public_read" on storage.objects;

-- Allow anyone to read product color images
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

-- 6. Create atomic stock decrement function
create or replace function public.decrement_product_stock(
  p_product_id text,
  p_color_name text,
  p_quantity integer
)
returns void
language plpgsql
security definer
as $$
begin
  update public.product_colors
  set stock = stock - p_quantity
  where product_id = p_product_id and color_name = p_color_name;
end;
$$;
