-- ============================================
-- ITEMS SEED DATA
-- Generated from product spreadsheet
-- Run AFTER 001_schema.sql and 002_business_rules.sql
-- ============================================

-- Clear existing items (optional - remove if appending)
-- TRUNCATE items CASCADE;

INSERT INTO items (sku, category, product, role, size, variant, unit, cost) VALUES
-- UNIFORMS - Trousers (All roles, sizes 26-50)
('UNI-TRO-26', 'Uniforms', 'Trousers', 'All', '26', NULL, 'unit', 32),
('UNI-TRO-28', 'Uniforms', 'Trousers', 'All', '28', NULL, 'unit', 32),
('UNI-TRO-30', 'Uniforms', 'Trousers', 'All', '30', NULL, 'unit', 32),
('UNI-TRO-32', 'Uniforms', 'Trousers', 'All', '32', NULL, 'unit', 32),
('UNI-TRO-34', 'Uniforms', 'Trousers', 'All', '34', NULL, 'unit', 32),
('UNI-TRO-36', 'Uniforms', 'Trousers', 'All', '36', NULL, 'unit', 32),
('UNI-TRO-38', 'Uniforms', 'Trousers', 'All', '38', NULL, 'unit', 32),
('UNI-TRO-40', 'Uniforms', 'Trousers', 'All', '40', NULL, 'unit', 32),
('UNI-TRO-42', 'Uniforms', 'Trousers', 'All', '42', NULL, 'unit', 32),
('UNI-TRO-44', 'Uniforms', 'Trousers', 'All', '44', NULL, 'unit', 32),
('UNI-TRO-46', 'Uniforms', 'Trousers', 'All', '46', NULL, 'unit', 32),
('UNI-TRO-48', 'Uniforms', 'Trousers', 'All', '48', NULL, 'unit', 32),
('UNI-TRO-50', 'Uniforms', 'Trousers', 'All', '50', NULL, 'unit', 32),

-- UNIFORMS - Shirts (Cashier)
('UNI-SHI-CAS-S', 'Uniforms', 'Shirt', 'Cashier', 'S', NULL, 'unit', 29),
('UNI-SHI-CAS-M', 'Uniforms', 'Shirt', 'Cashier', 'M', NULL, 'unit', 29),
('UNI-SHI-CAS-L', 'Uniforms', 'Shirt', 'Cashier', 'L', NULL, 'unit', 29),
('UNI-SHI-CAS-XL', 'Uniforms', 'Shirt', 'Cashier', 'XL', NULL, 'unit', 29),
('UNI-SHI-CAS-XXL', 'Uniforms', 'Shirt', 'Cashier', 'XXL', NULL, 'unit', 29),
('UNI-SHI-CAS-XXXL', 'Uniforms', 'Shirt', 'Cashier', 'XXXL', NULL, 'unit', 29),

-- UNIFORMS - Shirts (Manager)
('UNI-SHI-MGR-S', 'Uniforms', 'Shirt', 'Manager', 'S', NULL, 'unit', 29),
('UNI-SHI-MGR-M', 'Uniforms', 'Shirt', 'Manager', 'M', NULL, 'unit', 29),
('UNI-SHI-MGR-L', 'Uniforms', 'Shirt', 'Manager', 'L', NULL, 'unit', 29),
('UNI-SHI-MGR-XL', 'Uniforms', 'Shirt', 'Manager', 'XL', NULL, 'unit', 29),
('UNI-SHI-MGR-XXL', 'Uniforms', 'Shirt', 'Manager', 'XXL', NULL, 'unit', 29),
('UNI-SHI-MGR-XXXL', 'Uniforms', 'Shirt', 'Manager', 'XXXL', NULL, 'unit', 29),

-- UNIFORMS - Jersey (All - appears to be Cashier based on CAS prefix)
('UNI-JRSY-CAS-S', 'Uniforms', 'Jersey', 'All', 'S', NULL, 'unit', 29),
('UNI-JRSY-CAS-M', 'Uniforms', 'Jersey', 'All', 'M', NULL, 'unit', 29),
('UNI-JSRY-CAS-L', 'Uniforms', 'Jersey', 'All', 'L', NULL, 'unit', 29),
('UNI-JRSY-CAS-XL', 'Uniforms', 'Jersey', 'All', 'XL', NULL, 'unit', 29),
('UNI-JRSY-CAS-XXL', 'Uniforms', 'Jersey', 'All', 'XXL', NULL, 'unit', 29),
('UNI-JRSY-CAS-XXXL', 'Uniforms', 'Jersey', 'All', 'XXXL', NULL, 'unit', 29),

-- UNIFORMS - Jersey (Manager)
('UNI-JRSY-MGR-S', 'Uniforms', 'Jersey', 'All', 'S', NULL, 'unit', 29),
('UNI-JRSY-MGR-M', 'Uniforms', 'Jersey', 'All', 'M', NULL, 'unit', 29),
('UNI-JRSY-MGR-L', 'Uniforms', 'Jersey', 'All', 'L', NULL, 'unit', 29),
('UNI-JRSY-MGR-XL', 'Uniforms', 'Jersey', 'All', 'XL', NULL, 'unit', 29),
('UNI-JRSY-MGR-XXL', 'Uniforms', 'Jersey', 'All', 'XXL', NULL, 'unit', 29),
('UNI-JRSY-MGR-XXXL', 'Uniforms', 'Jersey', 'All', 'XXXL', NULL, 'unit', 29),

-- UNIFORMS - Skirts (All roles, sizes 26-50)
('UNI-SKT-26', 'Uniforms', 'Skirt', 'All', '26', NULL, 'unit', 26.5),
('UNI-SKT-28', 'Uniforms', 'Skirt', 'All', '28', NULL, 'unit', 26.5),
('UNI-SKT-30', 'Uniforms', 'Skirt', 'All', '30', NULL, 'unit', 26.5),
('UNI-SKT-32', 'Uniforms', 'Skirt', 'All', '32', NULL, 'unit', 26.5),
('UNI-SKT-34', 'Uniforms', 'Skirt', 'All', '34', NULL, 'unit', 26.5),
('UNI-SKT-36', 'Uniforms', 'Skirt', 'All', '36', NULL, 'unit', 26.5),
('UNI-SKT-38', 'Uniforms', 'Skirt', 'All', '38', NULL, 'unit', 26.5),
('UNI-SKT-40', 'Uniforms', 'Skirt', 'All', '40', NULL, 'unit', 26.5),
('UNI-SKT-42', 'Uniforms', 'Skirt', 'All', '42', NULL, 'unit', 26.5),
('UNI-SKT-44', 'Uniforms', 'Skirt', 'All', '44', NULL, 'unit', 26.5),
('UNI-SKT-46', 'Uniforms', 'Skirt', 'All', '46', NULL, 'unit', 26.5),
('UNI-SKT-48', 'Uniforms', 'Skirt', 'All', '48', NULL, 'unit', 26.5),
('UNI-SKT-50', 'Uniforms', 'Skirt', 'All', '50', NULL, 'unit', 26.5),

-- UNIFORMS - Headwear
('HDW-CAP', 'Uniforms', 'Cap', 'All', 'M', NULL, 'unit', 10),
('HDW-WOOL-HAT', 'Uniforms', 'Wool Hat', 'All', 'M', NULL, 'unit', 10),

-- UNIFORMS - Shoes (sizes 3-14)
('FTW-SHO-3', 'Uniforms', 'Shoes', 'All', '3', NULL, 'pair', 40.4),
('FTW-SHO-4', 'Uniforms', 'Shoes', 'All', '4', NULL, 'pair', 40.4),
('FTW-SHO-5', 'Uniforms', 'Shoes', 'All', '5', NULL, 'pair', 40.4),
('FTW-SHO-6', 'Uniforms', 'Shoes', 'All', '6', NULL, 'pair', 40.4),
('FTW-SHO-7', 'Uniforms', 'Shoes', 'All', '7', NULL, 'pair', 40.4),
('FTW-SHO-8', 'Uniforms', 'Shoes', 'All', '8', NULL, 'pair', 40.4),
('FTW-SHO-9', 'Uniforms', 'Shoes', 'All', '9', NULL, 'pair', 40.4),
('FTW-SHO-10', 'Uniforms', 'Shoes', 'All', '10', NULL, 'pair', 40.4),
('FTW-SHO-11', 'Uniforms', 'Shoes', 'All', '11', NULL, 'pair', 40.4),
('FTW-SHO-12', 'Uniforms', 'Shoes', 'All', '12', NULL, 'pair', 40.4),
('FTW-SHO-13', 'Uniforms', 'Shoes', 'All', '13', NULL, 'pair', 40.4),
('FTW-SHO-14', 'Uniforms', 'Shoes', 'All', '14', NULL, 'pair', 40.4),

-- UNIFORMS - Outerwear
('OUT-RN-COAT', 'Uniforms', 'Rain Coat', 'All', 'M', NULL, 'unit', 19.5),

-- UNIFORMS - Maternity
('UNI-MATS-DRESS', 'Uniforms', 'Maternity Dress + Top', 'All', 'S', NULL, 'unit', 45.5),
('UNI-MATM-DRESS', 'Uniforms', 'Maternity Dress + Top', 'All', 'M', NULL, 'unit', 45.5),
('UNI-MATL-DRESS', 'Uniforms', 'Maternity Dress + Top', 'All', 'L', NULL, 'unit', 45.5),

-- STATIONERY
('STA-CASH-REC', 'Stationery', 'Cash Sale Receipt', 'All', NULL, NULL, 'pack', 30.4),
('STA-SALES-SHEET', 'Stationery', 'Cashier Sales Sheet', 'All', NULL, NULL, 'unit', 9.77),
('STA-DRIVEWAY', 'Stationery', 'Driveway Sheet', 'All', NULL, NULL, 'unit', 22.77),
('STA-TILL-ROLL', 'Stationery', 'Till Rolls', 'All', NULL, NULL, 'unit', 22.77),

-- CONSUMABLES
('CON-DIP-PASTE', 'Consumable', 'Dipping Paste', 'All', NULL, NULL, 'tube', 8),
('CON-WATER-FINDER', 'Consumable', 'Water Finder', 'All', NULL, NULL, 'tube', 8),
('CON-KOLOR-KUT', 'Consumable', 'Kolor Kut', 'All', NULL, NULL, 'tube', 12),

-- PPE (Personal Protective Equipment)
('PPE-HARD-HAT', 'PPE', 'Hard Hat', 'All', NULL, NULL, 'unit', 3),
('PPE-HARNESS', 'PPE', 'Safety Harness', 'All', NULL, NULL, 'unit', 20),
('PPE-GLOVES', 'PPE', 'Gloves', 'All', NULL, NULL, 'pair', 5),
('PPE-SAFETY-CONE', 'PPE', 'Safety Cone', 'All', NULL, NULL, 'unit', 10),
('PPE-BARRICADE-TAPE', 'PPE', 'Barricade Tape', 'All', NULL, NULL, 'roll', 0),
('PPE-REFLECTIVE-VEST', 'PPE', 'Reflective Vest', 'All', NULL, NULL, 'unit', 0),
('PPE-GOGGLES', 'PPE', 'Safety Goggles', 'All', NULL, NULL, 'unit', 0),
('FA-FIRST-AID-KIT', 'PPE', 'First Aid Kit', 'All', NULL, NULL, 'unit', 0),
('SPILL-KIT-STD', 'PPE', 'Spill Kit', 'All', NULL, NULL, 'unit', 0)

ON CONFLICT (sku) DO UPDATE SET
    category = EXCLUDED.category,
    product = EXCLUDED.product,
    role = EXCLUDED.role,
    size = EXCLUDED.size,
    variant = EXCLUDED.variant,
    unit = EXCLUDED.unit,
    cost = EXCLUDED.cost;

-- Verify insert count
SELECT 
    category,
    COUNT(*) as item_count,
    SUM(cost) as total_catalog_cost
FROM items
WHERE is_active = true
GROUP BY category
ORDER BY category;
