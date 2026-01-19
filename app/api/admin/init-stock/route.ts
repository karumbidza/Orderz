import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// POST /api/admin/init-stock - Initialize warehouse and stock tables
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    // Create warehouse if not exists
    await sql`
      INSERT INTO warehouses (code, name, location, is_active)
      VALUES ('MAIN', 'Main Warehouse', 'Harare', true)
      ON CONFLICT (code) DO NOTHING
    `;

    // Get warehouse ID
    const warehouse = await sql`SELECT id FROM warehouses WHERE code = 'MAIN' LIMIT 1`;
    
    if (warehouse.length === 0) {
      return NextResponse.json({ success: false, error: 'Failed to create warehouse' }, { status: 500 });
    }

    const warehouseId = warehouse[0].id;

    // Initialize stock levels for all active items
    const result = await sql`
      INSERT INTO stock_levels (item_id, warehouse_id, quantity, min_quantity)
      SELECT 
        i.id,
        ${warehouseId},
        0,
        CASE 
          WHEN i.category = 'Uniforms' THEN 10
          WHEN i.category = 'Stationery' THEN 20
          WHEN i.category = 'Consumable' THEN 50
          ELSE 5
        END
      FROM items i
      WHERE i.is_active = true
      ON CONFLICT (item_id, warehouse_id) DO NOTHING
      RETURNING id
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Stock initialized. Warehouse: MAIN, Items with stock records: ${result.length}`,
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
    const warehouses = await sql`SELECT COUNT(*) as count FROM warehouses`;
    const stockLevels = await sql`SELECT COUNT(*) as count FROM stock_levels`;
    const items = await sql`SELECT COUNT(*) as count FROM items WHERE is_active = true`;

    return NextResponse.json({ 
      success: true,
      warehouses: warehouses[0].count,
      stock_records: stockLevels[0].count,
      active_items: items[0].count,
      message: stockLevels[0].count === 0 ? 'No stock data. POST to this endpoint to initialize.' : 'Stock data exists.'
    });

  } catch (error) {
    console.error('Error checking stock status:', error);
    return NextResponse.json({ success: false, error: 'Failed to check status: ' + String(error) }, { status: 500 });
  }
}
