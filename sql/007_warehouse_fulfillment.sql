-- =====================================================
-- WAREHOUSE SETUP & FULFILLMENT CONFIGURATION
-- =====================================================

-- HEAD OFFICE is the central warehouse (all stock held here)
INSERT INTO warehouses (code, name, address, is_active) VALUES
  ('HEAD-OFFICE', 'Head Office Warehouse', 'Redan Head Office, Harare', true)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  is_active = EXCLUDED.is_active;

-- Add fulfillment zone to sites table for order messaging
-- Zone determines the message sent after order confirmation
ALTER TABLE sites ADD COLUMN IF NOT EXISTS fulfillment_zone VARCHAR(20) DEFAULT 'DISPATCH';

-- Set fulfillment zones based on city
-- COLLECTION = Harare sites (can collect from Head Office)
-- DISPATCH = All other sites (order will be mailed/dispatched)
UPDATE sites 
SET fulfillment_zone = 'COLLECTION' 
WHERE city = 'Harare';

UPDATE sites 
SET fulfillment_zone = 'DISPATCH' 
WHERE city != 'Harare';

-- Verify zone distribution
SELECT 
  fulfillment_zone,
  COUNT(*) as site_count,
  STRING_AGG(city, ', ' ORDER BY city) as cities
FROM (
  SELECT DISTINCT fulfillment_zone, city FROM sites
) sub
GROUP BY fulfillment_zone;

-- Show sample of each zone
SELECT 
  fulfillment_zone, 
  site_code, 
  name, 
  city 
FROM sites 
ORDER BY fulfillment_zone, city, name 
LIMIT 20;
