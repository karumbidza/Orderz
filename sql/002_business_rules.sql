-- ============================================
-- BUSINESS RULES & CONSTRAINTS
-- Stock integrity, audit trail, validations
-- ============================================

-- ─────────────────────────────────────────────
-- FUNCTION: Calculate stock from movements
-- Derives stock level from the movement ledger
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_stock_from_movements(
    p_item_id INTEGER,
    p_warehouse_id INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_stock INTEGER;
BEGIN
    SELECT COALESCE(
        SUM(
            CASE 
                WHEN movement_type IN ('IN', 'RETURN') THEN quantity
                WHEN movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -quantity
                WHEN movement_type = 'ADJUSTMENT' THEN quantity  -- Can be positive or negative via separate logic
                ELSE 0
            END
        ), 0
    ) INTO v_stock
    FROM stock_movements
    WHERE item_id = p_item_id 
      AND warehouse_id = p_warehouse_id;
    
    RETURN v_stock;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- FUNCTION: Check stock availability
-- Returns available quantity for an item
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_stock_availability(
    p_item_id INTEGER,
    p_warehouse_id INTEGER,
    p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    SELECT quantity INTO v_available
    FROM stock_levels
    WHERE item_id = p_item_id 
      AND warehouse_id = p_warehouse_id;
    
    IF v_available IS NULL THEN
        RETURN FALSE;
    END IF;
    
    RETURN v_available >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- TRIGGER: Update stock_levels after movement
-- Automatically syncs stock_levels with movements
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_stock_after_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_quantity_change INTEGER;
BEGIN
    -- Calculate the quantity change based on movement type
    v_quantity_change := CASE 
        WHEN NEW.movement_type IN ('IN', 'RETURN') THEN NEW.quantity
        WHEN NEW.movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -NEW.quantity
        ELSE 0  -- ADJUSTMENT handled separately
    END;
    
    -- Upsert into stock_levels
    INSERT INTO stock_levels (item_id, warehouse_id, quantity)
    VALUES (NEW.item_id, NEW.warehouse_id, GREATEST(0, v_quantity_change))
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET 
        quantity = GREATEST(0, stock_levels.quantity + v_quantity_change),
        updated_at = CURRENT_TIMESTAMP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_stock_after_movement ON stock_movements;
CREATE TRIGGER trg_update_stock_after_movement
    AFTER INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION update_stock_after_movement();

-- ─────────────────────────────────────────────
-- TRIGGER: Validate stock before movement
-- Prevents negative stock on OUT movements
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION validate_stock_before_movement()
RETURNS TRIGGER AS $$
DECLARE
    v_current_stock INTEGER;
BEGIN
    -- Only check for outbound movements
    IF NEW.movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN
        SELECT COALESCE(quantity, 0) INTO v_current_stock
        FROM stock_levels
        WHERE item_id = NEW.item_id 
          AND warehouse_id = NEW.warehouse_id;
        
        IF v_current_stock < NEW.quantity THEN
            RAISE EXCEPTION 'Insufficient stock: Available %, Requested %', 
                v_current_stock, NEW.quantity;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_stock_before_movement ON stock_movements;
CREATE TRIGGER trg_validate_stock_before_movement
    BEFORE INSERT ON stock_movements
    FOR EACH ROW EXECUTE FUNCTION validate_stock_before_movement();

-- ─────────────────────────────────────────────
-- FUNCTION: Record stock movement (safe API)
-- The ONLY way to modify stock levels
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_stock_movement(
    p_item_id INTEGER,
    p_warehouse_id INTEGER,
    p_movement_type movement_type,
    p_quantity INTEGER,
    p_reference_type VARCHAR DEFAULT NULL,
    p_reference_id INTEGER DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_created_by VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_movement_id INTEGER;
BEGIN
    INSERT INTO stock_movements (
        item_id, warehouse_id, movement_type, quantity,
        reference_type, reference_id, notes, created_by
    ) VALUES (
        p_item_id, p_warehouse_id, p_movement_type, p_quantity,
        p_reference_type, p_reference_id, p_notes, p_created_by
    ) RETURNING id INTO v_movement_id;
    
    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- FUNCTION: Process order fulfillment
-- Creates stock movements for order items
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fulfill_order_item(
    p_order_item_id INTEGER,
    p_quantity INTEGER,
    p_fulfilled_by VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_order_id INTEGER;
    v_item_id INTEGER;
    v_warehouse_id INTEGER;
    v_ordered INTEGER;
    v_already_fulfilled INTEGER;
    v_remaining INTEGER;
BEGIN
    -- Get order item details
    SELECT oi.order_id, oi.item_id, oi.quantity_ordered, oi.quantity_fulfilled, o.warehouse_id
    INTO v_order_id, v_item_id, v_ordered, v_already_fulfilled, v_warehouse_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    WHERE oi.id = p_order_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order item not found: %', p_order_item_id;
    END IF;
    
    -- Check remaining quantity
    v_remaining := v_ordered - v_already_fulfilled;
    IF p_quantity > v_remaining THEN
        RAISE EXCEPTION 'Cannot fulfill % units; only % remaining', p_quantity, v_remaining;
    END IF;
    
    -- Record the stock movement
    PERFORM record_stock_movement(
        v_item_id,
        v_warehouse_id,
        'ORDER'::movement_type,
        p_quantity,
        'order',
        v_order_id,
        'Order fulfillment',
        p_fulfilled_by
    );
    
    -- Update the order item
    UPDATE order_items
    SET quantity_fulfilled = quantity_fulfilled + p_quantity
    WHERE id = p_order_item_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- FUNCTION: Reconcile stock levels
-- Syncs stock_levels with movement ledger
-- Use for periodic reconciliation
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION reconcile_stock_levels()
RETURNS TABLE (
    item_id INTEGER,
    warehouse_id INTEGER,
    recorded_qty INTEGER,
    calculated_qty INTEGER,
    difference INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH calculated AS (
        SELECT 
            sm.item_id,
            sm.warehouse_id,
            SUM(
                CASE 
                    WHEN sm.movement_type IN ('IN', 'RETURN') THEN sm.quantity
                    WHEN sm.movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -sm.quantity
                    ELSE 0
                END
            )::INTEGER as calc_qty
        FROM stock_movements sm
        GROUP BY sm.item_id, sm.warehouse_id
    )
    SELECT 
        sl.item_id,
        sl.warehouse_id,
        sl.quantity as recorded_qty,
        COALESCE(c.calc_qty, 0) as calculated_qty,
        (sl.quantity - COALESCE(c.calc_qty, 0)) as difference
    FROM stock_levels sl
    LEFT JOIN calculated c ON sl.item_id = c.item_id AND sl.warehouse_id = c.warehouse_id
    WHERE sl.quantity != COALESCE(c.calc_qty, 0);
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────
-- VIEW: Low stock alerts
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_low_stock AS
SELECT 
    sl.id,
    i.sku,
    i.product,
    i.category,
    w.code as warehouse_code,
    w.name as warehouse_name,
    sl.quantity,
    sl.min_quantity,
    (sl.min_quantity - sl.quantity) as shortage
FROM stock_levels sl
JOIN items i ON sl.item_id = i.id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE sl.quantity <= sl.min_quantity
  AND i.is_active = true
  AND w.is_active = true
ORDER BY shortage DESC;

-- ─────────────────────────────────────────────
-- VIEW: Stock summary with item details
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_stock_summary AS
SELECT 
    sl.id,
    sl.item_id,
    i.sku,
    i.category,
    i.product,
    i.role,
    i.size,
    i.variant,
    i.unit,
    i.cost,
    sl.warehouse_id,
    w.code as warehouse_code,
    w.name as warehouse_name,
    sl.quantity,
    sl.min_quantity,
    sl.max_quantity,
    (sl.quantity * i.cost) as stock_value,
    CASE 
        WHEN sl.quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN sl.quantity <= sl.min_quantity THEN 'LOW_STOCK'
        ELSE 'IN_STOCK'
    END as stock_status,
    sl.updated_at
FROM stock_levels sl
JOIN items i ON sl.item_id = i.id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE i.is_active = true
  AND w.is_active = true;

-- ─────────────────────────────────────────────
-- VIEW: Order summary with totals
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_order_summary AS
SELECT 
    o.id,
    o.order_number,
    o.status,
    s.code as site_code,
    s.name as site_name,
    w.code as warehouse_code,
    w.name as warehouse_name,
    o.ordered_by,
    o.ordered_at,
    o.approved_by,
    o.approved_at,
    COUNT(oi.id) as total_lines,
    SUM(oi.quantity_ordered) as total_qty_ordered,
    SUM(oi.quantity_fulfilled) as total_qty_fulfilled,
    SUM(oi.quantity_ordered * oi.unit_cost) as total_value,
    o.notes,
    o.created_at
FROM orders o
JOIN sites s ON o.site_id = s.id
JOIN warehouses w ON o.warehouse_id = w.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, s.code, s.name, w.code, w.name;
