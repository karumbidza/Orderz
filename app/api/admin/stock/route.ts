import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/stock - Get stock levels with item details
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const warehouse_id = searchParams.get('warehouse_id');
    const category = searchParams.get('category');

    let stockData;
    
    if (warehouse_id && category) {
      stockData = await sql`
        SELECT 
          sl.item_id,
          sl.warehouse_id,
          sl.quantity_on_hand,
          sl.last_updated,
          i.sku,
          i.product,
          i.category,
          i.role,
          i.size,
          i.unit,
          i.cost,
          i.is_active,
          w.code as warehouse_code,
          w.name as warehouse_name,
          (sl.quantity_on_hand * i.cost::numeric) as stock_value
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.warehouse_id = ${warehouse_id}
          AND i.category = ${category}
        ORDER BY i.product, i.role, i.size
      `;
    } else if (warehouse_id) {
      stockData = await sql`
        SELECT 
          sl.item_id,
          sl.warehouse_id,
          sl.quantity_on_hand,
          sl.last_updated,
          i.sku,
          i.product,
          i.category,
          i.role,
          i.size,
          i.unit,
          i.cost,
          i.is_active,
          w.code as warehouse_code,
          w.name as warehouse_name,
          (sl.quantity_on_hand * i.cost::numeric) as stock_value
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.warehouse_id = ${warehouse_id}
        ORDER BY i.category, i.product, i.role, i.size
      `;
    } else {
      stockData = await sql`
        SELECT 
          sl.item_id,
          sl.warehouse_id,
          sl.quantity_on_hand,
          sl.last_updated,
          i.sku,
          i.product,
          i.category,
          i.role,
          i.size,
          i.unit,
          i.cost,
          i.is_active,
          w.code as warehouse_code,
          w.name as warehouse_name,
          (sl.quantity_on_hand * i.cost::numeric) as stock_value
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        ORDER BY w.code, i.category, i.product, i.role, i.size
      `;
    }

    return NextResponse.json({ 
      success: true, 
      data: stockData,
      count: stockData.length 
    });

  } catch (error) {
    console.error('Error fetching stock levels:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch stock levels: ' + String(error)
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/stock - Add stock (IN movement)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, warehouse_id, quantity, reason } = body;

    if (!item_id || !warehouse_id || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'item_id, warehouse_id, and positive quantity are required' 
      }, { status: 400 });
    }

    // Create stock movement record (trigger auto-updates stock_levels)
    const movement = await sql`
      INSERT INTO stock_movements 
        (item_id, warehouse_id, movement_type, quantity, reference_type, reason, created_at)
      VALUES 
        (${item_id}, ${warehouse_id}, 'IN', ${quantity}, 'MANUAL_ADD', ${reason || 'Stock added via admin'}, NOW())
      RETURNING id, item_id, quantity
    `;

    // Get updated stock level (updated by trigger)
    const stockLevel = await sql`
      SELECT sl.quantity_on_hand, i.sku, i.product, w.name as warehouse_name
      FROM stock_levels sl
      JOIN items i ON sl.item_id = i.id
      JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE sl.item_id = ${item_id} AND sl.warehouse_id = ${warehouse_id}
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Added ${quantity} units. New stock: ${stockLevel[0]?.quantity_on_hand || quantity}`,
      movement_id: movement[0].id,
      new_quantity: stockLevel[0]?.quantity_on_hand || quantity
    });

  } catch (error) {
    console.error('Error adding stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add stock: ' + String(error)
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/stock - Dispatch stock (OUT movement)
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, warehouse_id, quantity, reason } = body;

    if (!item_id || !warehouse_id || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'item_id, warehouse_id, and positive quantity are required' 
      }, { status: 400 });
    }

    // Check current stock
    const currentStock = await sql`
      SELECT quantity_on_hand FROM stock_levels 
      WHERE item_id = ${item_id} AND warehouse_id = ${warehouse_id}
    `;

    if (currentStock.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No stock record found for this item/warehouse' 
      }, { status: 404 });
    }

    if (currentStock[0].quantity_on_hand < quantity) {
      return NextResponse.json({ 
        success: false, 
        error: `Insufficient stock. Available: ${currentStock[0].quantity_on_hand}, Requested: ${quantity}` 
      }, { status: 400 });
    }

    // Create stock movement record (trigger auto-updates stock_levels)
    const movement = await sql`
      INSERT INTO stock_movements 
        (item_id, warehouse_id, movement_type, quantity, reference_type, reason, created_at)
      VALUES 
        (${item_id}, ${warehouse_id}, 'OUT', ${-quantity}, 'MANUAL_DISPATCH', ${reason || 'Stock dispatched via admin'}, NOW())
      RETURNING id, item_id, quantity
    `;

    // Get updated stock level (updated by trigger)
    const stockLevel = await sql`
      SELECT sl.quantity_on_hand, i.sku, i.product, w.name as warehouse_name
      FROM stock_levels sl
      JOIN items i ON sl.item_id = i.id
      JOIN warehouses w ON sl.warehouse_id = w.id
      WHERE sl.item_id = ${item_id} AND sl.warehouse_id = ${warehouse_id}
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Dispatched ${quantity} units. New stock: ${stockLevel[0].quantity_on_hand}`,
      movement_id: movement[0].id,
      new_quantity: stockLevel[0].quantity_on_hand
    });

  } catch (error) {
    console.error('Error dispatching stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to dispatch stock: ' + String(error)
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PUT /api/admin/stock - Bulk receive stock
// Body: { items: [{ item_id, quantity, reason? }], warehouse_id }
// ─────────────────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { items, warehouse_id, grn_number } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'items array is required' 
      }, { status: 400 });
    }

    const warehouseId = warehouse_id || 2; // Default to Head Office
    const results: any[] = [];
    let totalAdded = 0;

    for (const item of items) {
      if (!item.item_id || !item.quantity || item.quantity <= 0) {
        results.push({ item_id: item.item_id, success: false, error: 'Invalid item data' });
        continue;
      }

      try {
        // Create stock movement record
        await sql`
          INSERT INTO stock_movements 
            (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, created_at)
          VALUES 
            (${item.item_id}, ${warehouseId}, 'IN', ${item.quantity}, 'BULK_RECEIVE', ${grn_number || null}, ${item.reason || 'Bulk stock receive'}, NOW())
        `;

        // Update or insert stock level
        await sql`
          INSERT INTO stock_levels (item_id, warehouse_id, quantity_on_hand, last_updated)
          VALUES (${item.item_id}, ${warehouseId}, ${item.quantity}, NOW())
          ON CONFLICT (item_id, warehouse_id) 
          DO UPDATE SET 
            quantity_on_hand = stock_levels.quantity_on_hand + ${item.quantity},
            last_updated = NOW()
        `;

        results.push({ item_id: item.item_id, success: true, quantity_added: item.quantity });
        totalAdded += item.quantity;

      } catch (err) {
        results.push({ item_id: item.item_id, success: false, error: String(err) });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Bulk receive complete. Added ${totalAdded} units across ${results.filter(r => r.success).length} items.`,
      grn_number,
      results
    });

  } catch (error) {
    console.error('Error bulk receiving stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to bulk receive stock: ' + String(error)
    }, { status: 500 });
  }
}
