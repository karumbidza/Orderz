-- Insert default warehouse if none exists
INSERT INTO warehouses (code, name, location, is_active)
VALUES ('MAIN', 'Main Warehouse', 'Harare', true)
ON CONFLICT (code) DO NOTHING;

-- Get the warehouse ID
DO $$
DECLARE
    main_warehouse_id INTEGER;
BEGIN
    SELECT id INTO main_warehouse_id FROM warehouses WHERE code = 'MAIN' LIMIT 1;
    
    -- Initialize stock levels for all active items with zero stock
    INSERT INTO stock_levels (item_id, warehouse_id, quantity, min_quantity)
    SELECT 
        i.id,
        main_warehouse_id,
        0,  -- Start with zero stock
        CASE 
            WHEN i.category = 'Uniforms' THEN 10
            WHEN i.category = 'Stationery' THEN 20
            WHEN i.category = 'Consumable' THEN 50
            ELSE 5
        END as min_quantity
    FROM items i
    WHERE i.is_active = true
    ON CONFLICT (item_id, warehouse_id) DO NOTHING;
END $$;
