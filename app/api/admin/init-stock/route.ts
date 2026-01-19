import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// POST /api/admin/init-stock - Initialize warehouse and stock tables
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Create warehouse if not exists (use HEAD-OFFICE as per schema)
    await sql`
      INSERT INTO warehouses (code, name, is_active)
      VALUES ('HEAD-OFFICE', 'Head Office Warehouse', true)
      ON CONFLICT (code) DO NOTHING
    `;

    // Get warehouse ID
    const warehouse = await sql`SELECT id FROM warehouses WHERE code = 'HEAD-OFFICE' LIMIT 1`;
    
    if (warehouse.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to create warehouse' }, { status: 500 });
    }

    const warehouseId = warehouse[0].id;

    // Initialize stock levels for all active items
    // Actual schema: item_id, warehouse_id, quantity_on_hand, last_updated
    const result = await sql`
      INSERT INTO stock_levels (item_id, warehouse_id, quantity_on_hand, last_updated)
      SELECT 
        i.id,
        ${warehouseId},
        0,
        NOW()
      FROM items i
      WHERE i.is_active = true
      ON CONFLICT (item_id, warehouse_id) DO NOTHING
      RETURNING item_id
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Stock initialized. Warehouse: HEAD-OFFICE, Items with stock records: ${result.length}`,
      warehouse_id: warehouseId
    });

  } catch (error) {
    console.error('Error initializing stock:', error);
    return NextResponse.json({ success: false, error: 'Failed to initialize stock: ' + String(error) }, { status: 500 });
  }
}

// GET - Check status
export async function GET(request: NextRequest) {
  try {
    // Check table structure
    const warehouseInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'warehouses'
    `;
    
    const stockInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_levels'
    `;
    
    const movementInfo = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_movements'
    `;

    const warehouses = await sql`SELECT * FROM warehouses LIMIT 1`;
    const stockLevels = await sql`SELECT COUNT(*) as count FROM stock_levels`;
    const items = await sql`SELECT COUNT(*) as count FROM items WHERE is_active = true`;

    return NextResponse.json({ 
      success: true,
      warehouse_columns: warehouseInfo,
      stock_columns: stockInfo,
      movement_columns: movementInfo,
      warehouse_sample: warehouses[0] || null,
      stock_records: stockLevels[0].count,
      active_items: items[0].count,
      message: stockLevels[0].count === 0 ? 'No stock data. POST to this endpoint to initialize.' : 'Stock data exists.'
    });

  } catch (error) {
    console.error('Error checking stock status:', error);
    return NextResponse.json({ success: false, error: 'Failed to check status: ' + String(error) }, { status: 500 });
  }
}
