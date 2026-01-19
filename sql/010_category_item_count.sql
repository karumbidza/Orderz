-- Add item_count column to categories table with auto-update trigger

-- Step 1: Add item_count column
ALTER TABLE categories ADD COLUMN IF NOT EXISTS item_count INTEGER DEFAULT 0;

-- Step 2: Populate with current counts
UPDATE categories c
SET item_count = (
    SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.is_active = true
);

-- Step 3: Create function to update category item count
CREATE OR REPLACE FUNCTION update_category_item_count()
RETURNS TRIGGER AS $func$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_active = true THEN
            UPDATE categories SET item_count = item_count + 1 WHERE id = NEW.category_id;
        END IF;
        RETURN NEW;
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        IF OLD.is_active = true THEN
            UPDATE categories SET item_count = item_count - 1 WHERE id = OLD.category_id;
        END IF;
        RETURN OLD;
    END IF;
    
    IF TG_OP = 'UPDATE' THEN
        IF OLD.category_id != NEW.category_id THEN
            IF OLD.is_active = true THEN
                UPDATE categories SET item_count = item_count - 1 WHERE id = OLD.category_id;
            END IF;
            IF NEW.is_active = true THEN
                UPDATE categories SET item_count = item_count + 1 WHERE id = NEW.category_id;
            END IF;
        ELSIF OLD.is_active != NEW.is_active THEN
            IF NEW.is_active = true THEN
                UPDATE categories SET item_count = item_count + 1 WHERE id = NEW.category_id;
            ELSE
                UPDATE categories SET item_count = item_count - 1 WHERE id = NEW.category_id;
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$func$ LANGUAGE plpgsql;

-- Step 4: Create trigger on items table
DROP TRIGGER IF EXISTS trigger_update_category_count ON items;
CREATE TRIGGER trigger_update_category_count
AFTER INSERT OR UPDATE OR DELETE ON items
FOR EACH ROW
EXECUTE FUNCTION update_category_item_count();
