-- =====================================================================
-- Finalize product_colors FK: drop old TEXT FK, promote catalog_id to UUID FK
-- =====================================================================

-- 1. Drop the old FK constraint pointing to products(id TEXT)
alter table public.product_colors
  drop constraint if exists product_colors_product_id_fkey;

-- 2. Drop the old unique constraint (product_id, color_name)
alter table public.product_colors
  drop constraint if exists product_colors_product_id_color_name_key;

-- 3. Make product_id nullable (it's being replaced by catalog_id)
--    Without this, trigger inserts that only supply catalog_id will fail.
alter table public.product_colors
  alter column product_id drop not null;

-- 4a. Make catalog_id NOT NULL
--    IMPORTANT: Only safe after porting script confirms zero orphaned records.
--    In local dev, product_colors is empty so this always succeeds.
--    In production, run the porting script first.
alter table public.product_colors
  alter column catalog_id set not null;

-- 5. Add FK constraint: catalog_id → product_catalog.id
alter table public.product_colors
  add constraint product_colors_catalog_id_fkey
  foreign key (catalog_id) references public.product_catalog(id) on delete cascade;

-- 6. Add unique constraint on (catalog_id, color_name)
alter table public.product_colors
  add constraint product_colors_catalog_id_color_name_unique
  unique (catalog_id, color_name);

-- 7. Update decrement_product_stock: change p_product_id from text → uuid
create or replace function public.decrement_product_stock(
  p_product_id uuid,
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
  where catalog_id = p_product_id and color_name = p_color_name;
end;
$$;

-- 8. Update handle_new_product_colors trigger to insert using catalog_id
create or replace function public.handle_new_product_colors()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.product_colors (catalog_id, color_name, stock)
  values
    (new.id, 'White', 10),
    (new.id, 'Black', 10)
  on conflict (catalog_id, color_name) do nothing;
  return new;
end;
$$;

-- 9. Re-attach trigger to product_catalog (auto-seed colors on new product insert)
drop trigger if exists on_product_created on public.product_catalog;
create trigger on_product_created
  after insert on public.product_catalog
  for each row execute function public.handle_new_product_colors();
