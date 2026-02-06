import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/inventory - Get all items for admin
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '500');
    const category = searchParams.get('category');

    let items;
    if (category) {
      items = await sql`
        SELECT 
          id, sku, category, product, role, size, unit, cost, 
          is_active, created_at, updated_at
        FROM items
        WHERE category = ${category}
        ORDER BY category, product, role, size
        LIMIT ${limit}
      `;
    } else {
      items = await sql`
        SELECT 
          id, sku, category, product, role, size, unit, cost, 
          is_active, created_at, updated_at
        FROM items
        ORDER BY category, product, role, size
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ success: true, data: items, count: items.length });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/inventory - Update item (cost, active status)
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, cost, is_active } = body;

    if (!item_id) {
      return NextResponse.json({ success: false, error: 'item_id is required' }, { status: 400 });
    }

    // Build update dynamically based on what's provided
    let result;
    
    if (cost !== undefined && is_active !== undefined) {
      result = await sql`
        UPDATE items 
        SET cost = ${cost}, is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else if (cost !== undefined) {
      result = await sql`
        UPDATE items 
        SET cost = ${cost}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else if (is_active !== undefined) {
      result = await sql`
        UPDATE items 
        SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else {
      return NextResponse.json({ success: false, error: 'Nothing to update. Provide cost or is_active' }, { status: 400 });
    }

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Item ${result[0].sku} updated`,
      item: result[0]
    });

  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/inventory - Add new item
// Features:
// - Auto-generate SKU from category + product if not provided
// - Lookup category_id from category name
// - Auto-create stock record in default warehouse
// - Support for tracking_type (QUANTITY, SERIALIZED, ASSIGNED)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sku: providedSku, 
      category, 
      category_id: providedCategoryId,
      product, 
      role, 
      size, 
      variant,
      unit, 
      cost,
      tracking_type,
      is_serialized,
      requires_employee,
      initial_quantity,
      warehouse_id,
      created_by
    } = body;

    // Validate required fields
    if (!product) {
      return NextResponse.json({ 
        success: false, 
        error: 'product name is required' 
      }, { status: 400 });
    }

    if (!category && !providedCategoryId) {
      return NextResponse.json({ 
        success: false, 
        error: 'category (name) or category_id is required' 
      }, { status: 400 });
    }

    // Resolve category - get both name and id
    let categoryName = category;
    let categoryId = providedCategoryId;

    if (providedCategoryId && !category) {
      // Lookup category name from ID
      const catLookup = await sql`
        SELECT id, name FROM categories WHERE id = ${providedCategoryId} AND is_active = true
      `;
      if (catLookup.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: `Invalid category_id: ${providedCategoryId}` 
        }, { status: 400 });
      }
      categoryName = catLookup[0].name;
      categoryId = catLookup[0].id;
    } else if (category && !providedCategoryId) {
      // Lookup category ID from name
      const catLookup = await sql`
        SELECT id, name FROM categories WHERE LOWER(name) = LOWER(${category}) AND is_active = true
      `;
      if (catLookup.length === 0) {
        return NextResponse.json({ 
          success: false, 
          error: `Invalid category name: ${category}. Valid categories: Uniforms, Stationery, PPE, Consumable` 
        }, { status: 400 });
      }
      categoryName = catLookup[0].name;
      categoryId = catLookup[0].id;
    }

    // Generate SKU if not provided
    let sku = providedSku;
    if (!sku) {
      // Build SKU prefix from category (first 3 chars uppercase)
      const prefix = (categoryName || 'ITM').substring(0, 3).toUpperCase();
      
      // Build SKU suffix from product name (remove spaces, uppercase, first 10 chars)
      const suffix = product
        .replace(/[^a-zA-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .toUpperCase()
        .substring(0, 15);
      
      // Add size if present
      const sizePart = size ? `-${size.toUpperCase().replace(/\s+/g, '')}` : '';
      
      sku = `${prefix}-${suffix}${sizePart}`;
    }

    // Check if SKU already exists
    const existing = await sql`SELECT id, sku, product FROM items WHERE sku = ${sku}`;
    if (existing.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `SKU "${sku}" already exists for product: ${existing[0].product}` 
      }, { status: 400 });
    }

    // Determine tracking type based on category if not provided
    let itemTrackingType = tracking_type || 'QUANTITY';
    let itemIsSerialized = is_serialized || false;
    let itemRequiresEmployee = requires_employee || false;

    if (!tracking_type) {
      if (categoryName === 'Uniforms') {
        itemTrackingType = 'ASSIGNED';
        itemRequiresEmployee = true;
      } else if (categoryName === 'Stationery' && 
                 (product.toLowerCase().includes('receipt') || 
                  product.toLowerCase().includes('sheet') || 
                  product.toLowerCase().includes('book'))) {
        itemTrackingType = 'SERIALIZED';
        itemIsSerialized = true;
      }
    }

    // Insert the item
    const result = await sql`
      INSERT INTO items (
        sku, 
        category, 
        category_id,
        product, 
        role, 
        size, 
        variant,
        unit, 
        cost, 
        tracking_type,
        is_serialized,
        requires_employee,
        is_active
      )
      VALUES (
        ${sku}, 
        ${categoryName}, 
        ${categoryId},
        ${product}, 
        ${role || 'All'}, 
        ${size || null}, 
        ${variant || null},
        ${unit || 'unit'}, 
        ${cost || 0},
        ${itemTrackingType},
        ${itemIsSerialized},
        ${itemRequiresEmployee},
        true
      )
      RETURNING id, sku, product, category, category_id, role, size, unit, cost, tracking_type
    `;

    const newItem = result[0];

    // Auto-create stock record if warehouse exists
    let stockRecord = null;
    const defaultWarehouseId = warehouse_id || 2; // Default to HEAD-OFFICE

    try {
      // Check if warehouse exists
      const warehouseCheck = await sql`
        SELECT id, code, name FROM warehouses WHERE id = ${defaultWarehouseId} AND is_active = true
      `;

      if (warehouseCheck.length > 0) {
        // Create stock level record
        const initialQty = initial_quantity || 0;
        
        await sql`
          INSERT INTO stock_levels (item_id, warehouse_id, quantity_on_hand, last_updated)
          VALUES (${newItem.id}, ${defaultWarehouseId}, ${initialQty}, NOW())
          ON CONFLICT (item_id, warehouse_id) DO UPDATE SET
            quantity_on_hand = stock_levels.quantity_on_hand + ${initialQty},
            last_updated = NOW()
        `;

        // If initial quantity > 0, create stock movement
        if (initialQty > 0) {
          await sql`
            INSERT INTO stock_movements 
              (item_id, warehouse_id, movement_type, quantity, reference_type, reason, created_by, created_at)
            VALUES 
              (${newItem.id}, ${defaultWarehouseId}, 'IN', ${initialQty}, 
               'INITIAL_STOCK', 'Initial stock on item creation', ${created_by || 'Admin'}, NOW())
          `;
        }

        stockRecord = {
          warehouse_id: defaultWarehouseId,
          warehouse_code: warehouseCheck[0].code,
          quantity_on_hand: initialQty
        };
      }
    } catch (stockError) {
      console.warn('Could not create stock record:', stockError);
      // Don't fail the item creation if stock record fails
    }

    return NextResponse.json({ 
      success: true, 
      message: `Item "${newItem.product}" created with SKU: ${newItem.sku}`,
      item: newItem,
      stock: stockRecord
    });

  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to create item: ' + String(error)
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// DELETE /api/admin/inventory - Soft delete item
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');

    if (!item_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'item_id query parameter is required' 
      }, { status: 400 });
    }

    const result = await sql`
      UPDATE items 
      SET is_active = false, updated_at = NOW()
      WHERE id = ${item_id}
      RETURNING id, sku, product
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Item "${result[0].product}" (${result[0].sku}) deactivated`,
      item: result[0]
    });

  } catch (error) {
    console.error('Error deleting item:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete item' }, { status: 500 });
  }
}
