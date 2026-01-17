-- =====================================================
-- REFINED SCHEMA - COMPREHENSIVE INVENTORY SYSTEM
-- =====================================================
-- Key Changes:
-- 1. Sites have local mini-warehouses (site_stock)
-- 2. Uniforms tracked by employee (issued_to)
-- 3. Stationery control books tracked by serial number
-- 4. Reorder levels for consumables/stationery
-- 5. Enhanced order flow with employee info
-- =====================================================

-- =====================================================
-- 1. ITEM TRACKING CONFIGURATION
-- Add tracking type to items to determine how each item is tracked
-- =====================================================
ALTER TABLE items ADD COLUMN IF NOT EXISTS tracking_type VARCHAR(20) DEFAULT 'QUANTITY';
-- QUANTITY = Simple count (PPE, Consumables)
-- SERIALIZED = Individual serial numbers (Receipt books, control stationery)
-- ASSIGNED = Tracked to employee (Uniforms)

ALTER TABLE items ADD COLUMN IF NOT EXISTS is_serialized BOOLEAN DEFAULT FALSE;
ALTER TABLE items ADD COLUMN IF NOT EXISTS requires_employee BOOLEAN DEFAULT FALSE;

-- Set tracking types based on category
UPDATE items SET tracking_type = 'ASSIGNED', requires_employee = TRUE WHERE category = 'Uniforms';
UPDATE items SET tracking_type = 'SERIALIZED', is_serialized = TRUE WHERE category = 'Stationery' AND product IN ('Cash Sale Receipt', 'Cashier Sales Sheet', 'Driveway Sheet');
UPDATE items SET tracking_type = 'QUANTITY' WHERE tracking_type IS NULL OR tracking_type = 'QUANTITY';

-- =====================================================
-- 2. EMPLOYEES TABLE
-- Track employees for uniform assignments
-- =====================================================
CREATE TABLE IF NOT EXISTS employees (
    id SERIAL PRIMARY KEY,
    employee_code VARCHAR(20) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    site_id INTEGER REFERENCES sites(id),
    role VARCHAR(100),                    -- Job title/role
    phone VARCHAR(20),
    email VARCHAR(255),
    hire_date DATE,
    status VARCHAR(20) DEFAULT 'ACTIVE',  -- ACTIVE, TERMINATED, SUSPENDED
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_employees_site ON employees(site_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- =====================================================
-- 3. SITE STOCK (Mini-warehouse at each site)
-- Sites receive orders and hold stock locally
-- =====================================================
CREATE TABLE IF NOT EXISTS site_stock (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity_on_hand INTEGER DEFAULT 0,
    reorder_level INTEGER DEFAULT 0,       -- When to trigger reorder
    reorder_quantity INTEGER DEFAULT 0,    -- How much to order when triggered
    last_received TIMESTAMP,               -- Last time stock was received
    last_issued TIMESTAMP,                 -- Last time stock was issued/used
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(site_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_site_stock_site ON site_stock(site_id);
CREATE INDEX IF NOT EXISTS idx_site_stock_item ON site_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_site_stock_reorder ON site_stock(site_id) WHERE quantity_on_hand <= reorder_level;

-- =====================================================
-- 4. SITE STOCK MOVEMENTS
-- Track all in/out movements at site level
-- =====================================================
CREATE TABLE IF NOT EXISTS site_stock_movements (
    id SERIAL PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    movement_type VARCHAR(20) NOT NULL,   -- RECEIVED, ISSUED, ADJUSTMENT, RETURN
    quantity INTEGER NOT NULL,
    balance_after INTEGER,                 -- Running balance after movement
    
    -- Context fields
    reference_type VARCHAR(30),            -- ORDER, ADJUSTMENT, RETURN, TRANSFER
    reference_id INTEGER,                  -- order_id, etc.
    
    -- For uniforms - who received it
    employee_id INTEGER REFERENCES employees(id),
    
    -- For serialized items - which serial numbers
    serial_numbers TEXT[],                 -- Array of serial numbers moved
    
    reason TEXT,                           -- Why this movement happened
    performed_by VARCHAR(100),             -- Who did this action
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ssm_site ON site_stock_movements(site_id);
CREATE INDEX IF NOT EXISTS idx_ssm_item ON site_stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_ssm_employee ON site_stock_movements(employee_id);
CREATE INDEX IF NOT EXISTS idx_ssm_type ON site_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_ssm_date ON site_stock_movements(created_at);

-- =====================================================
-- 5. SERIALIZED ITEMS (Control Books with Serial Numbers)
-- Track individual receipt books, cashier sheets, etc.
-- =====================================================
CREATE TABLE IF NOT EXISTS serialized_inventory (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES items(id),
    serial_number VARCHAR(50) NOT NULL,
    
    -- Location tracking
    current_location_type VARCHAR(20) NOT NULL, -- WAREHOUSE, SITE, ISSUED, VOID
    warehouse_id INTEGER REFERENCES warehouses(id),
    site_id INTEGER REFERENCES sites(id),
    
    -- Assignment tracking
    issued_to_employee_id INTEGER REFERENCES employees(id),
    issued_date TIMESTAMP,
    
    -- Lifecycle
    status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, ISSUED, IN_USE, COMPLETED, VOID, LOST
    received_at_warehouse TIMESTAMP DEFAULT NOW(),
    received_at_site TIMESTAMP,
    
    -- For receipt books - track usage
    start_number INTEGER,                   -- First receipt number in book
    end_number INTEGER,                     -- Last receipt number in book
    current_number INTEGER,                 -- Current receipt number (if tracking)
    
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(item_id, serial_number)
);

CREATE INDEX IF NOT EXISTS idx_serial_item ON serialized_inventory(item_id);
CREATE INDEX IF NOT EXISTS idx_serial_site ON serialized_inventory(site_id);
CREATE INDEX IF NOT EXISTS idx_serial_warehouse ON serialized_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_serial_status ON serialized_inventory(status);
CREATE INDEX IF NOT EXISTS idx_serial_employee ON serialized_inventory(issued_to_employee_id);

-- =====================================================
-- 6. UNIFORM ASSIGNMENTS
-- Track uniform items assigned to employees
-- =====================================================
CREATE TABLE IF NOT EXISTS uniform_assignments (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER NOT NULL REFERENCES employees(id),
    item_id INTEGER NOT NULL REFERENCES items(id),
    quantity INTEGER DEFAULT 1,
    
    -- Assignment tracking
    assigned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    returned_date DATE,                     -- NULL if still assigned
    condition_on_return VARCHAR(20),        -- GOOD, WORN, DAMAGED, LOST
    
    -- Source tracking
    order_id INTEGER REFERENCES orders(id),
    site_stock_movement_id INTEGER REFERENCES site_stock_movements(id),
    
    -- Lifecycle
    status VARCHAR(20) DEFAULT 'ACTIVE',    -- ACTIVE, RETURNED, LOST, WRITTEN_OFF
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_uniform_employee ON uniform_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_uniform_item ON uniform_assignments(item_id);
CREATE INDEX IF NOT EXISTS idx_uniform_status ON uniform_assignments(status);
CREATE INDEX IF NOT EXISTS idx_uniform_order ON uniform_assignments(order_id);

-- =====================================================
-- 7. ENHANCED ORDER ITEMS
-- Add employee info for uniform orders, serial tracking for stationery
-- =====================================================
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS id SERIAL;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS employee_id INTEGER REFERENCES employees(id);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS employee_name VARCHAR(200);  -- Denormalized for easy Excel viewing
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS notes TEXT;

-- =====================================================
-- 8. REORDER ALERTS VIEW
-- Identify items that need reordering at each site
-- =====================================================
CREATE OR REPLACE VIEW v_reorder_alerts AS
SELECT 
    s.id as site_id,
    s.site_code,
    s.name as site_name,
    s.city,
    s.fulfillment_zone,
    i.id as item_id,
    i.sku,
    i.category,
    i.product,
    i.size,
    ss.quantity_on_hand,
    ss.reorder_level,
    ss.reorder_quantity,
    ss.last_received,
    ss.last_issued,
    CASE 
        WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
        WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
        WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
        ELSE 'OK'
    END as stock_status
FROM site_stock ss
JOIN sites s ON ss.site_id = s.id
JOIN items i ON ss.item_id = i.id
WHERE ss.quantity_on_hand <= ss.reorder_level
  AND ss.reorder_level > 0
ORDER BY 
    CASE WHEN ss.quantity_on_hand <= 0 THEN 0 ELSE 1 END,
    s.site_code,
    i.category,
    i.product;

-- =====================================================
-- 9. EMPLOYEE UNIFORM SUMMARY VIEW
-- See all uniforms assigned to each employee
-- =====================================================
CREATE OR REPLACE VIEW v_employee_uniforms AS
SELECT 
    e.id as employee_id,
    e.employee_code,
    e.first_name || ' ' || e.last_name as employee_name,
    e.role,
    s.site_code,
    s.name as site_name,
    i.sku,
    i.product,
    i.size,
    ua.quantity,
    ua.assigned_date,
    ua.status,
    ua.order_id
FROM uniform_assignments ua
JOIN employees e ON ua.employee_id = e.id
JOIN items i ON ua.item_id = i.id
LEFT JOIN sites s ON e.site_id = s.id
WHERE ua.status = 'ACTIVE'
ORDER BY e.last_name, e.first_name, i.product;

-- =====================================================
-- 10. SERIALIZED ITEM TRACKING VIEW
-- Track where all control books are
-- =====================================================
CREATE OR REPLACE VIEW v_serialized_items AS
SELECT 
    si.id,
    si.serial_number,
    i.sku,
    i.product,
    si.status,
    si.current_location_type,
    COALESCE(w.name, s.name) as current_location_name,
    s.site_code,
    e.employee_code,
    e.first_name || ' ' || e.last_name as issued_to_name,
    si.issued_date,
    si.start_number,
    si.end_number,
    si.current_number,
    si.received_at_warehouse,
    si.received_at_site
FROM serialized_inventory si
JOIN items i ON si.item_id = i.id
LEFT JOIN warehouses w ON si.warehouse_id = w.id
LEFT JOIN sites s ON si.site_id = s.id
LEFT JOIN employees e ON si.issued_to_employee_id = e.id
ORDER BY i.product, si.serial_number;

-- =====================================================
-- 11. SITE STOCK SUMMARY VIEW
-- Quick overview of stock at each site
-- =====================================================
CREATE OR REPLACE VIEW v_site_stock_summary AS
SELECT 
    s.id as site_id,
    s.site_code,
    s.name as site_name,
    s.city,
    i.category,
    COUNT(*) as item_count,
    SUM(ss.quantity_on_hand) as total_quantity,
    SUM(CASE WHEN ss.quantity_on_hand <= 0 THEN 1 ELSE 0 END) as out_of_stock_count,
    SUM(CASE WHEN ss.quantity_on_hand <= ss.reorder_level AND ss.reorder_level > 0 THEN 1 ELSE 0 END) as needs_reorder_count
FROM site_stock ss
JOIN sites s ON ss.site_id = s.id
JOIN items i ON ss.item_id = i.id
GROUP BY s.id, s.site_code, s.name, s.city, i.category
ORDER BY s.site_code, i.category;

-- =====================================================
-- 12. FUNCTIONS
-- =====================================================

-- Function to record receiving stock at a site (from order fulfillment)
CREATE OR REPLACE FUNCTION receive_stock_at_site(
    p_site_id INTEGER,
    p_item_id INTEGER,
    p_quantity INTEGER,
    p_order_id INTEGER DEFAULT NULL,
    p_employee_id INTEGER DEFAULT NULL,
    p_serial_numbers TEXT[] DEFAULT NULL,
    p_performed_by VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_movement_id INTEGER;
    v_new_balance INTEGER;
BEGIN
    -- Upsert site_stock record
    INSERT INTO site_stock (site_id, item_id, quantity_on_hand, last_received)
    VALUES (p_site_id, p_item_id, p_quantity, NOW())
    ON CONFLICT (site_id, item_id) 
    DO UPDATE SET 
        quantity_on_hand = site_stock.quantity_on_hand + p_quantity,
        last_received = NOW(),
        updated_at = NOW()
    RETURNING quantity_on_hand INTO v_new_balance;
    
    -- Record the movement
    INSERT INTO site_stock_movements (
        site_id, item_id, movement_type, quantity, balance_after,
        reference_type, reference_id, employee_id, serial_numbers,
        reason, performed_by
    ) VALUES (
        p_site_id, p_item_id, 'RECEIVED', p_quantity, v_new_balance,
        CASE WHEN p_order_id IS NOT NULL THEN 'ORDER' ELSE NULL END,
        p_order_id, p_employee_id, p_serial_numbers,
        'Stock received from Head Office', p_performed_by
    ) RETURNING id INTO v_movement_id;
    
    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- Function to issue stock at a site (to employee or consumption)
CREATE OR REPLACE FUNCTION issue_stock_at_site(
    p_site_id INTEGER,
    p_item_id INTEGER,
    p_quantity INTEGER,
    p_employee_id INTEGER DEFAULT NULL,
    p_serial_numbers TEXT[] DEFAULT NULL,
    p_reason TEXT DEFAULT NULL,
    p_performed_by VARCHAR DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_movement_id INTEGER;
    v_new_balance INTEGER;
    v_current_balance INTEGER;
BEGIN
    -- Check current balance
    SELECT quantity_on_hand INTO v_current_balance
    FROM site_stock
    WHERE site_id = p_site_id AND item_id = p_item_id;
    
    IF v_current_balance IS NULL OR v_current_balance < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', 
            COALESCE(v_current_balance, 0), p_quantity;
    END IF;
    
    -- Update site_stock
    UPDATE site_stock 
    SET quantity_on_hand = quantity_on_hand - p_quantity,
        last_issued = NOW(),
        updated_at = NOW()
    WHERE site_id = p_site_id AND item_id = p_item_id
    RETURNING quantity_on_hand INTO v_new_balance;
    
    -- Record the movement
    INSERT INTO site_stock_movements (
        site_id, item_id, movement_type, quantity, balance_after,
        employee_id, serial_numbers, reason, performed_by
    ) VALUES (
        p_site_id, p_item_id, 'ISSUED', -p_quantity, v_new_balance,
        p_employee_id, p_serial_numbers, p_reason, p_performed_by
    ) RETURNING id INTO v_movement_id;
    
    RETURN v_movement_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VERIFICATION
-- =====================================================
SELECT 'Schema update complete!' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
