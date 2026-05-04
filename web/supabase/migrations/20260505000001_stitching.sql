-- Bespoke stitching support (Phase 5)
alter table public.order_items
  add column stitching text not null default 'none'
    check (stitching in ('none','bespoke')),
  add column stitching_addon numeric not null default 0;
