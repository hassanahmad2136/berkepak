-- =====================================================================
-- Berke Pak — complete schema, self-hosted Postgres.
--
-- Replaces the Supabase-managed schema. Differences from the old setup:
--   * `auth.users` is gone — `users` below is the identity table, and it
--     absorbs what the old `profiles` table held (full_name, phone).
--   * No row-level security. Every query now runs server-side over a trusted
--     connection, so authorization is enforced in application code rather
--     than by the 34 RLS policies that were keyed on auth.uid().
--   * Storage buckets become rows in `files` + objects in MinIO/S3.
-- =====================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()

-- Shared updated_at trigger (replaces the moddatetime contrib module).
create or replace function set_updated_at() returns trigger
language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- ---------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------

create table users (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  password_hash     text,                       -- null when the account is OAuth-only
  full_name         text,
  phone             text,
  google_id         text unique,
  email_verified_at timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint users_email_not_blank check (length(btrim(email)) > 0)
);
-- Case-insensitive uniqueness without requiring the citext extension.
create unique index users_email_lower_key on users (lower(email));
create trigger users_touch before update on users
  for each row execute function set_updated_at();

-- Server-side sessions. The cookie carries an opaque token; only its hash is
-- stored, so a database leak does not hand out live sessions.
create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  user_agent text,
  ip         inet,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index sessions_user_id_idx on sessions(user_id);
create index sessions_expires_at_idx on sessions(expires_at);

create table password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index password_reset_tokens_user_id_idx on password_reset_tokens(user_id);

create table email_verification_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create table admin_users (
  user_id    uuid primary key references users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Customer records
-- ---------------------------------------------------------------------

create table addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  line1       text not null,
  line2       text,
  city        text not null,
  province    text not null,
  postal_code text not null,
  country     text not null default 'Pakistan',
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
create index addresses_user_id_idx on addresses(user_id);

create table measurements (
  user_id    uuid primary key references users(id) on delete cascade,
  chest      numeric(5,2),
  waist      numeric(5,2),
  hip        numeric(5,2),
  shoulder   numeric(5,2),
  sleeve     numeric(5,2),
  length     numeric(5,2),
  neck       numeric(5,2),
  notes      text,
  updated_at timestamptz not null default now()
);
create trigger measurements_touch before update on measurements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------

create table product_catalog (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              text not null,
  -- Retained for legacy/campaign targeting. Material categories are no longer
  -- surfaced in the storefront; new products default to 'fabric'.
  category          text not null default 'fabric',
  weave_type        text,
  gsm               integer,
  thread_count      integer,
  composition       text default '',
  description       text default '',
  short_description text default '',
  price_per_meter   numeric(10,2) not null default 0,
  price_per_suit    numeric(10,2) not null default 0,
  meters_per_suit   numeric(5,2)  not null default 2.75,
  images            text[] not null default '{}',
  is_new            boolean not null default false,
  is_featured       boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint product_price_non_negative check (price_per_suit >= 0 and price_per_meter >= 0)
);
create index product_catalog_is_active_idx on product_catalog(is_active);
create trigger product_catalog_touch before update on product_catalog
  for each row execute function set_updated_at();

create table product_colors (
  id         uuid primary key default gen_random_uuid(),
  catalog_id uuid not null references product_catalog(id) on delete cascade,
  color_name text not null,
  image_url  text,
  stock      integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now(),
  unique (catalog_id, color_name)
);
create index product_colors_catalog_id_idx on product_colors(catalog_id);

-- New products get a default colour pair so the catalog is never unsellable.
create or replace function seed_default_product_colors() returns trigger
language plpgsql as $fn$
begin
  insert into product_colors (catalog_id, color_name, stock)
  values (new.id, 'White', 10), (new.id, 'Black', 10)
  on conflict (catalog_id, color_name) do nothing;
  return new;
end;
$fn$;
create trigger product_catalog_seed_colors after insert on product_catalog
  for each row execute function seed_default_product_colors();

-- ---------------------------------------------------------------------
-- Promotions & campaigns
-- ---------------------------------------------------------------------

create table promotions (
  id               uuid primary key default gen_random_uuid(),
  type             text not null check (type in ('banner','coupon')),
  title            text not null,
  body             text,
  code             text unique,
  discount_type    text check (discount_type in ('pct','fixed')),
  discount_value   numeric(10,2),
  min_order_amount numeric(10,2) not null default 0,
  is_active        boolean not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);

create table campaigns (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  discount_type    text not null check (discount_type in ('pct','fixed')),
  discount_value   numeric(10,2) not null,
  scope            text not null check (scope in ('all','categories','products')),
  category_targets text[] not null default '{}',
  product_targets  uuid[] not null default '{}',
  priority         integer not null default 0,
  is_active        boolean not null default true,
  starts_at        timestamptz,
  ends_at          timestamptz,
  created_at       timestamptz not null default now()
);
create index campaigns_active_idx on campaigns(is_active, priority desc);

-- ---------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------

create table orders (
  id               text primary key,             -- human-facing, e.g. BPK-1A2B3C4D
  -- Null for guest checkout. Guests are reachable by guest_email, and prove
  -- ownership of the order with guest_token (emailed to them) so they can
  -- upload a bank-transfer receipt without an account.
  user_id          uuid references users(id) on delete set null,
  guest_email      text,
  guest_token      text,
  status           text not null default 'unconfirmed'
                     check (status in ('unconfirmed','confirmed','fulfilled','shipped','delivered','cancelled')),
  payment_method   text not null check (payment_method in ('cod','bank_transfer','online')),
  payment_status   text not null default 'pending'
                     check (payment_status in ('pending','awaiting_receipt','awaiting_review','paid','failed','refunded')),
  subtotal         numeric(10,2) not null default 0,
  shipping         numeric(10,2) not null default 0,
  discount_amount  numeric(10,2) not null default 0,
  promo_id         uuid references promotions(id) on delete set null,
  total            numeric(10,2) not null default 0,
  -- Gateway fee folded into listed prices and included in total; zero for
  -- direct bank transfer. total - payment_surcharge is what the business nets.
  payment_surcharge numeric(10,2) not null default 0,
  shipping_address jsonb not null,
  otp_verified     boolean not null default false,
  -- Fulfilment. courier and tracking_number are set together when an order
  -- ships; an order marked shipped without them is one nobody can chase.
  courier          text,
  tracking_number  text,
  shipped_at       timestamptz,
  delivered_at     timestamptz,
  cancelled_at     timestamptz,
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index orders_user_id_idx on orders(user_id);
create index orders_created_at_idx on orders(created_at desc);
create index orders_guest_token_idx on orders(guest_token) where guest_token is not null;
create trigger orders_touch before update on orders
  for each row execute function set_updated_at();

create table order_items (
  id              bigserial primary key,
  order_id        text not null references orders(id) on delete cascade,
  product_id      uuid references product_catalog(id) on delete set null,
  product_name    text not null,               -- denormalised: survives catalog edits
  product_slug    text not null,
  unit            text not null check (unit in ('meter','suit')),
  quantity        numeric(10,2) not null check (quantity > 0),
  unit_price      numeric(10,2) not null,
  stitching       text not null default 'none' check (stitching in ('none','bespoke')),
  stitching_addon numeric(10,2) not null default 0,
  line_total      numeric(10,2) not null,
  color           text not null default 'White'
);
create index order_items_order_id_idx on order_items(order_id);

-- ---------------------------------------------------------------------
-- Online payments
--
-- One row per attempt, not per order: a customer may abandon a Raast request
-- and retry, and each attempt needs its own provider reference and status.
-- The order stays the source of truth for "is this paid"; payments records how.
-- ---------------------------------------------------------------------

create table payments (
  id             uuid primary key default gen_random_uuid(),
  order_id       text not null references orders(id) on delete cascade,
  provider       text not null,                    -- 'mock', 'onelink', ...
  method         text not null,                    -- 'raast_rtp', 'raast_qr', 'card'
  provider_ref   text,                             -- the provider's id for this attempt
  amount         numeric(10,2) not null,
  currency       text not null default 'PKR',
  status         text not null default 'initiated'
                   check (status in ('initiated','pending','paid','failed','expired','cancelled')),
  redirect_url   text,
  qr_payload     text,
  failure_reason text,
  raw_request    jsonb,
  raw_response   jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index payments_order_id_idx on payments(order_id);
-- A provider reference identifies exactly one attempt, so a replayed webhook
-- can always be resolved back to the same payment row.
create unique index payments_provider_ref_key
  on payments(provider, provider_ref) where provider_ref is not null;
create trigger payments_touch before update on payments
  for each row execute function set_updated_at();

-- Webhook log. The unique constraint is the idempotency guard: providers retry
-- deliveries, and a double-credit here is a double-shipped order.
create table payment_events (
  id          uuid primary key default gen_random_uuid(),
  payment_id  uuid references payments(id) on delete cascade,
  provider    text not null,
  event_id    text not null,
  status      text,
  payload     jsonb,
  received_at timestamptz not null default now(),
  unique (provider, event_id)
);
create index payment_events_payment_id_idx on payment_events(payment_id);

-- ---------------------------------------------------------------------
-- Object storage metadata (replaces Supabase Storage buckets)
-- ---------------------------------------------------------------------

create table files (
  id          uuid primary key default gen_random_uuid(),
  bucket      text not null check (bucket in ('receipts','product-images')),
  object_key  text not null,                   -- key within the S3/MinIO bucket
  mime_type   text,
  size_bytes  bigint,
  owner_id    uuid references users(id) on delete set null,
  is_public   boolean not null default false,  -- receipts private, product images public
  created_at  timestamptz not null default now(),
  unique (bucket, object_key)
);
create index files_owner_id_idx on files(owner_id);

create table receipts (
  id           uuid primary key default gen_random_uuid(),
  -- Null for a guest order; the owning order carries the contact details.
  user_id      uuid references users(id) on delete cascade,
  order_id     text references orders(id) on delete set null,
  file_id      uuid references files(id) on delete set null,
  storage_path text not null,
  -- The bank's reference for the transfer, typed by the customer.
  transaction_id text,
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by  uuid references users(id) on delete set null,
  reviewed_at  timestamptz,
  note         text,
  created_at   timestamptz not null default now()
);
create index receipts_user_id_idx on receipts(user_id);
create index receipts_status_idx on receipts(status);
-- One transfer cannot be claimed against two orders. A rejected receipt frees
-- its id so a genuine customer can resubmit after a mistake.
create unique index receipts_transaction_id_key
  on receipts (upper(transaction_id))
  where transaction_id is not null and status <> 'rejected';

-- ---------------------------------------------------------------------
-- Wishlist & OTP
-- ---------------------------------------------------------------------

create table wishlist (
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references product_catalog(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table otp_codes (
  id          uuid primary key default gen_random_uuid(),
  -- Email address or mobile number the code was sent to.
  destination text not null,
  code        text not null,
  channel     text not null default 'email' check (channel in ('email','whatsapp','sms')),
  attempts    integer not null default 0,
  consumed_at timestamptz,
  expires_at  timestamptz not null default now() + interval '15 minutes',
  created_at  timestamptz not null default now()
);
create index otp_codes_destination_idx on otp_codes(destination, created_at desc);

create table newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);
create unique index newsletter_subscribers_email_lower_key
  on newsletter_subscribers (lower(email));

-- ---------------------------------------------------------------------
-- Stock + atomic order placement
-- ---------------------------------------------------------------------

create or replace function decrement_product_stock(
  p_product_id uuid, p_color_name text, p_quantity integer
) returns boolean
language plpgsql as $fn$
declare current_stock integer;
begin
  select stock into current_stock
    from product_colors
   where catalog_id = p_product_id and color_name = p_color_name
     for update;                                   -- lock: prevents concurrent oversell

  if not found then return false; end if;
  if current_stock < p_quantity then return false; end if;

  update product_colors
     set stock = greatest(stock - p_quantity, 0)
   where catalog_id = p_product_id and color_name = p_color_name;
  return true;
end;
$fn$;

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
