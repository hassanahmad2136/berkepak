-- Fulfilment: courier, tracking and the cancel path.
--
-- db/init/01-schema.sql already contains all of this, so a fresh volume needs
-- nothing. An existing database needs it applied once:
--
--   docker exec -i berkepak_db psql -U berkepak -d berkepak -v ON_ERROR_STOP=1 < db/migrations/002-fulfilment.sql
--
-- Safe to re-run.

begin;

alter table orders add column if not exists courier         text;
alter table orders add column if not exists tracking_number text;
alter table orders add column if not exists shipped_at      timestamptz;
alter table orders add column if not exists delivered_at    timestamptz;
alter table orders add column if not exists cancelled_at    timestamptz;
alter table orders add column if not exists cancel_reason   text;

-- Cancelling an order puts its suits back. Kept beside decrement_product_stock
-- so both halves of the stock story live in one place.
create or replace function restock_order_items(p_order_id text) returns void
language plpgsql as $fn$
begin
  update product_colors pc
     set stock = pc.stock + agg.qty
    from (
      select product_id, color, ceil(sum(quantity))::integer as qty
        from order_items
       where order_id = p_order_id and product_id is not null
       group by product_id, color
    ) as agg
   where pc.catalog_id = agg.product_id and pc.color_name = agg.color;
end;
$fn$;

commit;
