-- Replace decrement_product_stock with a version that:
-- 1. Acquires a FOR UPDATE row lock to prevent concurrent overselling race conditions
-- 2. Returns FALSE if stock is insufficient (instead of silently going negative)
-- 3. Uses GREATEST(..., 0) as a final safety floor

CREATE OR REPLACE FUNCTION decrement_product_stock(
  p_product_id UUID,
  p_color_name TEXT,
  p_quantity INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_stock INT;
BEGIN
  -- Lock the row to prevent concurrent race on the same product+color
  SELECT stock INTO current_stock
  FROM product_colors
  WHERE catalog_id = p_product_id
    AND color_name = p_color_name
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF current_stock < p_quantity THEN
    RETURN FALSE;
  END IF;

  UPDATE product_colors
  SET stock = GREATEST(stock - p_quantity, 0)
  WHERE catalog_id = p_product_id
    AND color_name = p_color_name;

  RETURN TRUE;
END;
$$;
