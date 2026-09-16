-- PayFast pricing and bank-transfer transaction ids.
--
-- db/init/01-schema.sql already contains all of this, so a fresh volume needs
-- nothing. An existing database needs it applied once:
--
--   docker exec -i berkepak_db psql -U berkepak -d berkepak -v ON_ERROR_STOP=1 < db/migrations/001-payfast-pricing.sql
--
-- Safe to re-run.

begin;

alter table orders
  add column if not exists payment_surcharge numeric(10,2) not null default 0;

alter table receipts
  add column if not exists transaction_id text;

create unique index if not exists receipts_transaction_id_key
  on receipts (upper(transaction_id))
  where transaction_id is not null and status <> 'rejected';

-- Adding a parameter makes a new overload rather than replacing the function,
-- so the old signature is dropped first or both would exist side by side.
drop function if exists place_order_atomic(
  text, uuid, text, text, text, numeric, numeric, numeric, uuid, numeric, jsonb, boolean, jsonb
);

-- Order + items + stock decrement in one transaction: any failure rolls the
-- whole thing back, so a partial order can never be persisted.
create or replace function place_order_atomic(
  p_order_id         text,
  p_user_id          uuid,
  p_status           text,
  p_payment_method   text,
  p_payment_status   text,
  p_subtotal         numeric,
  p_shipping         numeric,
  p_discount_amount  numeric,
  p_promo_id         uuid,
  p_total            numeric,
  p_shipping_address jsonb,
  p_otp_verified     boolean,
  p_items            jsonb,
  p_payment_surcharge numeric
) returns text
language plpgsql as $fn$
declare
  v_item     jsonb;
  v_stock_ok boolean;
begin
  insert into orders (
    id, user_id, status, payment_method, payment_status,
    subtotal, shipping, discount_amount, promo_id, total,
    shipping_address, otp_verified, payment_surcharge
  ) values (
    p_order_id, p_user_id, p_status, p_payment_method, p_payment_status,
    p_subtotal, p_shipping, p_discount_amount, p_promo_id, p_total,
    p_shipping_address, p_otp_verified, p_payment_surcharge
  );

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into order_items (
      order_id, product_id, product_name, product_slug,
      unit, quantity, unit_price, stitching, stitching_addon, line_total, color
    ) values (
      p_order_id,
      (v_item->>'product_id')::uuid,
      v_item->>'product_name',
      v_item->>'product_slug',
      v_item->>'unit',
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      v_item->>'stitching',
      (v_item->>'stitching_addon')::numeric,
      (v_item->>'line_total')::numeric,
      v_item->>'color'
    );

    v_stock_ok := decrement_product_stock(
      (v_item->>'product_id')::uuid,
      coalesce(v_item->>'color', 'White'),
      ceil((v_item->>'quantity')::numeric)::integer
    );
    if not v_stock_ok then
      raise exception 'Insufficient stock for product % (color: %)',
        v_item->>'product_name', coalesce(v_item->>'color','White');
    end if;
  end loop;

  return p_order_id;
end;
$fn$;

commit;
