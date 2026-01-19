-- Trigger to sync item category names when category is renamed

CREATE OR REPLACE FUNCTION sync_items_on_category_rename()
RETURNS TRIGGER AS $func$
BEGIN
    -- When category name changes, update all items with this category_id
    IF OLD.name != NEW.name THEN
        UPDATE items SET category = NEW.name WHERE category_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

-- Create trigger on categories table
DROP TRIGGER IF EXISTS trigger_sync_items_category_name ON categories;
CREATE TRIGGER trigger_sync_items_category_name
AFTER UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION sync_items_on_category_rename();
