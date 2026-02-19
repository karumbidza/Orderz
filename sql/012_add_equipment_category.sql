-- Add Equipment category for items like Fuel Pumps, Utility Bins, Chairs, etc.
-- Run this in Neon SQL Editor

INSERT INTO categories (name, description, is_active)
VALUES ('Equipment', 'Operational equipment including fuel pumps, furniture, generators, storage bins, lockers, etc.', true)
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT id, name, description, item_count FROM categories ORDER BY name;
