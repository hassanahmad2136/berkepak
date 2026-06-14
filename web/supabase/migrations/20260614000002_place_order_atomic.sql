-- Atomic order placement function.
-- Inserts the order row, all order_items, and decrements stock in a single
-- transaction. Any failure (including insufficient stock) rolls back the
-- entire operation so the DB can never end up with a partial order.

CREATE OR REPLACE FUNCTION public.place_order_atomic(
  p_order_id        TEXT,
  p_user_id         UUID,
  p_status          TEXT,
  p_payment_method  TEXT,
  p_payment_status  TEXT,
  p_subtotal        NUMERIC,
  p_shipping        NUMERIC,
  p_discount_amount NUMERIC,
  p_promo_id        UUID,
  p_total           NUMERIC,
  p_shipping_address JSONB,
  p_otp_verified    BOOLEAN,
  p_items           JSONB  -- array of order item objects
)
RETURNS TEXT  -- returns order_id on success, raises EXCEPTION on failure
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      JSONB;
  v_stock_ok  BOOLEAN;
  v_product_id UUID;
BEGIN
  -- Step 1: Insert order
  INSERT INTO public.orders (
    id, user_id, status, payment_method, payment_status,
    subtotal, shipping, discount_amount, promo_id, total,
    shipping_address, otp_verified
  ) VALUES (
    p_order_id, p_user_id, p_status, p_payment_method, p_payment_status,
    p_subtotal, p_shipping, p_discount_amount, p_promo_id, p_total,
    p_shipping_address, p_otp_verified
  );

  -- Step 2: Insert order_items from JSONB array
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.order_items (
      order_id, product_id, product_name, product_slug,
      unit, quantity, unit_price, stitching, stitching_addon, line_total, color
    ) VALUES (
      p_order_id,
      v_item->>'product_id',       -- TEXT (matches order_items.product_id column type)
      v_item->>'product_name',
      v_item->>'product_slug',
      v_item->>'unit',
      (v_item->>'quantity')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      v_item->>'stitching',
      (v_item->>'stitching_addon')::NUMERIC,
      (v_item->>'line_total')::NUMERIC,
      v_item->>'color'
    );
  END LOOP;

  -- Step 3: Decrement stock for each item — transaction rolls back if any fail
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_product_id := (v_item->>'product_id')::UUID;  -- decrement_product_stock takes UUID

    SELECT public.decrement_product_stock(
      v_product_id,
      v_item->>'color',
      (v_item->>'quantity')::INTEGER
    ) INTO v_stock_ok;

    IF NOT v_stock_ok THEN
      RAISE EXCEPTION 'Insufficient stock for product % (color: %)',
        (v_item->>'product_name'),
        (v_item->>'color');
    END IF;
  END LOOP;

  RETURN p_order_id;
END;
$$;

-- Only service role can call this (shoppers call via server actions which use service role)
REVOKE ALL ON FUNCTION public.place_order_atomic FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.place_order_atomic TO service_role;
