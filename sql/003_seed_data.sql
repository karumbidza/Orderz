-- ============================================
-- SEED DATA TEMPLATES
-- Copy these and fill in your data
-- ============================================

-- ─────────────────────────────────────────────
-- WAREHOUSES - Run first (referenced by others)
-- ─────────────────────────────────────────────
INSERT INTO warehouses (code, name, location, is_active) VALUES
('MAIN', 'Main Warehouse', 'Central Distribution Center', true),
('NORTH', 'North Regional', 'Northern Region Hub', true),
('SOUTH', 'South Regional', 'Southern Region Hub', true)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────
-- ITEMS - Template for Excel generation
-- 
-- In Excel, create columns:
-- A: sku | B: category | C: product | D: role | E: size | F: variant | G: unit | H: cost
--
-- In column I (sql), use this formula:
-- ="INSERT INTO items (sku, category, product, role, size, variant, unit, cost) VALUES ('"&A2&"', '"&B2&"', '"&C2&"', "&IF(D2="","NULL","'"&D2&"'")&", "&IF(E2="","NULL","'"&E2&"'")&", "&IF(F2="","NULL","'"&F2&"'")&", '"&G2&"', "&H2&") ON CONFLICT (sku) DO UPDATE SET category = EXCLUDED.category, product = EXCLUDED.product, role = EXCLUDED.role, size = EXCLUDED.size, variant = EXCLUDED.variant, unit = EXCLUDED.unit, cost = EXCLUDED.cost;"
-- ─────────────────────────────────────────────

-- Example items (replace with your actual data)
INSERT INTO items (sku, category, product, role, size, variant, unit, cost) VALUES
('UNI-SHIRT-M-BLU', 'Uniforms', 'Work Shirt', 'General', 'M', 'Blue', 'EACH', 25.00),
('UNI-SHIRT-L-BLU', 'Uniforms', 'Work Shirt', 'General', 'L', 'Blue', 'EACH', 25.00),
('UNI-PANTS-M-BLK', 'Uniforms', 'Work Pants', 'General', 'M', 'Black', 'EACH', 35.00),
('PPE-GLOVES-M', 'PPE', 'Safety Gloves', NULL, 'M', NULL, 'PAIR', 8.50),
('PPE-HELMET-STD', 'PPE', 'Safety Helmet', NULL, 'Standard', 'White', 'EACH', 22.00),
('CON-SOAP-500', 'Consumables', 'Hand Soap', NULL, '500ml', NULL, 'BOTTLE', 4.50),
('STA-PEN-BLK', 'Stationery', 'Ballpoint Pen', NULL, NULL, 'Black', 'BOX', 12.00)
ON CONFLICT (sku) DO UPDATE SET
    category = EXCLUDED.category,
    product = EXCLUDED.product,
    role = EXCLUDED.role,
    size = EXCLUDED.size,
    variant = EXCLUDED.variant,
    unit = EXCLUDED.unit,
    cost = EXCLUDED.cost;

-- ─────────────────────────────────────────────
-- SITES - Template for Excel generation
--
-- In Excel, create columns:
-- A: code | B: name | C: address | D: contact_person | E: email | F: phone
--
-- In column G (sql), use this formula:
-- ="INSERT INTO sites (code, name, address, contact_person, email, phone) VALUES ('"&A2&"', '"&B2&"', "&IF(C2="","NULL","'"&C2&"'")&", "&IF(D2="","NULL","'"&D2&"'")&", "&IF(E2="","NULL","'"&E2&"'")&", "&IF(F2="","NULL","'"&F2&"'")&") ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, contact_person = EXCLUDED.contact_person, email = EXCLUDED.email, phone = EXCLUDED.phone;"
-- ─────────────────────────────────────────────

-- Example sites (replace with your actual 69 sites)
INSERT INTO sites (code, name, address, contact_person, email, phone) VALUES
('HQ', 'Head Office', '123 Main Street, City Center', 'John Smith', 'john.smith@company.com', '+1234567890'),
('BR001', 'Branch 001', '456 North Avenue', 'Jane Doe', 'jane.doe@company.com', '+1234567891'),
('BR002', 'Branch 002', '789 South Road', 'Bob Wilson', 'bob.wilson@company.com', '+1234567892'),
('BR003', 'Branch 003', '321 East Street', 'Alice Brown', 'alice.brown@company.com', '+1234567893')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    address = EXCLUDED.address,
    contact_person = EXCLUDED.contact_person,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone;

-- ─────────────────────────────────────────────
-- INITIAL STOCK LEVELS
-- After inserting items and warehouses, initialize stock
-- ─────────────────────────────────────────────

-- Option 1: Initialize all items at all warehouses with 0 stock
INSERT INTO stock_levels (item_id, warehouse_id, quantity, min_quantity)
SELECT i.id, w.id, 0, 10
FROM items i
CROSS JOIN warehouses w
WHERE i.is_active = true AND w.is_active = true
ON CONFLICT (item_id, warehouse_id) DO NOTHING;

-- Option 2: Add initial stock via stock movements (PREFERRED - creates audit trail)
-- Use the record_stock_movement function:
-- SELECT record_stock_movement(
--     item_id := 1,
--     warehouse_id := 1,
--     movement_type := 'IN',
--     quantity := 100,
--     reference_type := 'initial_stock',
--     notes := 'Initial inventory count',
--     created_by := 'admin'
-- );

-- Bulk initial stock example (creates proper audit trail):
DO $$
DECLARE
    v_item RECORD;
    v_warehouse_id INTEGER;
BEGIN
    -- Get main warehouse ID
    SELECT id INTO v_warehouse_id FROM warehouses WHERE code = 'MAIN';
    
    -- Add initial stock for each item
    FOR v_item IN SELECT id FROM items WHERE is_active = true LOOP
        PERFORM record_stock_movement(
            v_item.id,
            v_warehouse_id,
            'IN'::movement_type,
            100,  -- Initial quantity
            'initial_stock',
            NULL,
            'Initial inventory setup',
            'system'
        );
    END LOOP;
END $$;
