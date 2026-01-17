-- ============================================
-- QUICK REFERENCE SQL QUERIES
-- Useful queries for administration
-- ============================================

-- ─────────────────────────────────────────────
-- STOCK QUERIES
-- ─────────────────────────────────────────────

-- View all stock with details
SELECT * FROM v_stock_summary ORDER BY warehouse_code, sku;

-- Low stock items
SELECT * FROM v_low_stock ORDER BY shortage DESC;

-- Stock value by warehouse
SELECT 
    warehouse_code,
    warehouse_name,
    COUNT(*) as item_count,
    SUM(quantity) as total_units,
    SUM(stock_value)::money as total_value
FROM v_stock_summary
GROUP BY warehouse_code, warehouse_name
ORDER BY total_value DESC;

-- Stock value by category
SELECT 
    category,
    COUNT(*) as item_count,
    SUM(quantity) as total_units,
    SUM(stock_value)::money as total_value
FROM v_stock_summary
GROUP BY category
ORDER BY total_value DESC;

-- Items with no stock records
SELECT i.* 
FROM items i
LEFT JOIN stock_levels sl ON i.id = sl.item_id
WHERE sl.id IS NULL AND i.is_active = true;

-- ─────────────────────────────────────────────
-- MOVEMENT QUERIES
-- ─────────────────────────────────────────────

-- Recent movements (last 7 days)
SELECT 
    sm.created_at,
    i.sku,
    i.product,
    w.code as warehouse,
    sm.movement_type,
    sm.quantity,
    sm.reference_type,
    sm.notes,
    sm.created_by
FROM stock_movements sm
JOIN items i ON sm.item_id = i.id
JOIN warehouses w ON sm.warehouse_id = w.id
WHERE sm.created_at > NOW() - INTERVAL '7 days'
ORDER BY sm.created_at DESC;

-- Movement summary by type
SELECT 
    movement_type,
    COUNT(*) as movement_count,
    SUM(quantity) as total_quantity
FROM stock_movements
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY movement_type
ORDER BY movement_count DESC;

-- Movements for specific item
SELECT 
    sm.created_at,
    w.code as warehouse,
    sm.movement_type,
    sm.quantity,
    sm.notes
FROM stock_movements sm
JOIN warehouses w ON sm.warehouse_id = w.id
WHERE sm.item_id = (SELECT id FROM items WHERE sku = 'YOUR-SKU-HERE')
ORDER BY sm.created_at DESC;

-- ─────────────────────────────────────────────
-- ORDER QUERIES
-- ─────────────────────────────────────────────

-- Order summary
SELECT * FROM v_order_summary ORDER BY ordered_at DESC;

-- Orders pending approval
SELECT * FROM v_order_summary WHERE status = 'PENDING' ORDER BY ordered_at;

-- Orders by site
SELECT 
    site_code,
    site_name,
    COUNT(*) as order_count,
    SUM(total_value)::money as total_value
FROM v_order_summary
WHERE ordered_at > NOW() - INTERVAL '30 days'
GROUP BY site_code, site_name
ORDER BY total_value DESC;

-- Unfulfilled order items
SELECT 
    o.order_number,
    s.code as site,
    i.sku,
    i.product,
    oi.quantity_ordered,
    oi.quantity_fulfilled,
    (oi.quantity_ordered - oi.quantity_fulfilled) as remaining
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN sites s ON o.site_id = s.id
JOIN items i ON oi.item_id = i.id
WHERE oi.quantity_fulfilled < oi.quantity_ordered
  AND o.status NOT IN ('CANCELLED', 'DELIVERED')
ORDER BY o.ordered_at;

-- ─────────────────────────────────────────────
-- ADMIN QUERIES
-- ─────────────────────────────────────────────

-- Run stock reconciliation
SELECT * FROM reconcile_stock_levels();

-- Fix stock discrepancy (if any found)
-- WARNING: Only run if you understand the discrepancy
UPDATE stock_levels sl
SET quantity = (
    SELECT COALESCE(SUM(
        CASE 
            WHEN movement_type IN ('IN', 'RETURN') THEN quantity
            WHEN movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -quantity
            ELSE 0
        END
    ), 0)
    FROM stock_movements sm
    WHERE sm.item_id = sl.item_id AND sm.warehouse_id = sl.warehouse_id
)
WHERE sl.id IN (
    SELECT sl2.id FROM stock_levels sl2
    WHERE sl2.quantity != (
        SELECT COALESCE(SUM(
            CASE 
                WHEN movement_type IN ('IN', 'RETURN') THEN quantity
                WHEN movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -quantity
                ELSE 0
            END
        ), 0)
        FROM stock_movements sm
        WHERE sm.item_id = sl2.item_id AND sm.warehouse_id = sl2.warehouse_id
    )
);

-- Table sizes
SELECT 
    relname as table_name,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes,
    n_live_tup as live_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;

-- ─────────────────────────────────────────────
-- DATA EXPORT QUERIES
-- ─────────────────────────────────────────────

-- Export items for Excel template
SELECT 
    sku,
    category,
    product,
    COALESCE(role, '') as role,
    COALESCE(size, '') as size,
    COALESCE(variant, '') as variant,
    unit,
    cost
FROM items
WHERE is_active = true
ORDER BY category, sku;

-- Export sites
SELECT 
    code,
    name,
    COALESCE(address, '') as address,
    COALESCE(contact_person, '') as contact_person,
    COALESCE(email, '') as email,
    COALESCE(phone, '') as phone
FROM sites
WHERE is_active = true
ORDER BY code;

-- Export stock for Excel
SELECT 
    i.sku,
    i.product,
    w.code as warehouse,
    sl.quantity,
    sl.min_quantity,
    i.cost,
    (sl.quantity * i.cost) as stock_value
FROM stock_levels sl
JOIN items i ON sl.item_id = i.id
JOIN warehouses w ON sl.warehouse_id = w.id
WHERE i.is_active = true AND w.is_active = true
ORDER BY w.code, i.sku;
