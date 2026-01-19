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
    const low_stock = searchParams.get('low_stock') === 'true';

    let stockData;
    
    if (warehouse_id && category) {
      stockData = await sql`
        SELECT 
          sl.id as stock_id,
          sl.item_id,
          sl.warehouse_id,
          sl.quantity,
          sl.min_quantity,
          sl.max_quantity,
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
          (sl.quantity * i.cost::numeric) as stock_value
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
          sl.id as stock_id,
          sl.item_id,
          sl.warehouse_id,
          sl.quantity,
          sl.min_quantity,
          sl.max_quantity,
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
          (sl.quantity * i.cost::numeric) as stock_value
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.warehouse_id = ${warehouse_id}
        ORDER BY i.category, i.product, i.role, i.size
      `;
    } else if (low_stock) {
      stockData = await sql`
        SELECT 
          sl.id as stock_id,
          sl.item_id,
          sl.warehouse_id,
          sl.quantity,
          sl.min_quantity,
          sl.max_quantity,
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
          (sl.quantity * i.cost::numeric) as stock_value
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.quantity <= sl.min_quantity
        ORDER BY (sl.min_quantity - sl.quantity) DESC, i.product
      `;
    } else {
      stockData = await sql`
        SELECT 
          sl.id as stock_id,
          sl.item_id,
          sl.warehouse_id,
          sl.quantity,
          sl.min_quantity,
          sl.max_quantity,
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
          (sl.quantity * i.cost::numeric) as stock_value
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
      error: 'Failed to fetch stock levels' 
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/stock - Add stock (IN movement)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, warehouse_id, quantity, notes, created_by } = body;

    if (!item_id || !warehouse_id || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'item_id, warehouse_id, and positive quantity are required' 
      }, { status: 400 });
    }

    // Start transaction
    await sql`BEGIN`;

    try {
      // Create stock movement record
      const movement = await sql`
        INSERT INTO stock_movements 
          (item_id, warehouse_id, movement_type, quantity, reference_type, notes, created_by)
        VALUES 
          (${item_id}, ${warehouse_id}, 'IN', ${quantity}, 'manual_add', ${notes || null}, ${created_by || 'Admin'})
        RETURNING id, item_id, quantity
      `;

      // Update or insert stock level
      await sql`
        INSERT INTO stock_levels (item_id, warehouse_id, quantity)
        VALUES (${item_id}, ${warehouse_id}, ${quantity})
        ON CONFLICT (item_id, warehouse_id) 
        DO UPDATE SET 
          quantity = stock_levels.quantity + ${quantity},
          updated_at = NOW()
      `;

      // Get updated stock level
      const stockLevel = await sql`
        SELECT sl.quantity, i.sku, i.product, w.name as warehouse_name
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.item_id = ${item_id} AND sl.warehouse_id = ${warehouse_id}
      `;

      await sql`COMMIT`;

      return NextResponse.json({ 
        success: true, 
        message: `Added ${quantity} units. New stock: ${stockLevel[0].quantity}`,
        movement_id: movement[0].id,
        new_quantity: stockLevel[0].quantity
      });

    } catch (err) {
      await sql`ROLLBACK`;
      throw err;
    }

  } catch (error) {
    console.error('Error adding stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to add stock' 
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/stock - Dispatch stock (OUT movement)
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, warehouse_id, quantity, notes, created_by } = body;

    if (!item_id || !warehouse_id || !quantity || quantity <= 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'item_id, warehouse_id, and positive quantity are required' 
      }, { status: 400 });
    }

    // Check current stock
    const currentStock = await sql`
      SELECT quantity FROM stock_levels 
      WHERE item_id = ${item_id} AND warehouse_id = ${warehouse_id}
    `;

    if (currentStock.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'No stock record found for this item/warehouse' 
      }, { status: 404 });
    }

    if (currentStock[0].quantity < quantity) {
      return NextResponse.json({ 
        success: false, 
        error: `Insufficient stock. Available: ${currentStock[0].quantity}, Requested: ${quantity}` 
      }, { status: 400 });
    }

    // Start transaction
    await sql`BEGIN`;

    try {
      // Create stock movement record
      const movement = await sql`
        INSERT INTO stock_movements 
          (item_id, warehouse_id, movement_type, quantity, reference_type, notes, created_by)
        VALUES 
          (${item_id}, ${warehouse_id}, 'OUT', ${quantity}, 'manual_dispatch', ${notes || null}, ${created_by || 'Admin'})
        RETURNING id, item_id, quantity
      `;

      // Update stock level
      await sql`
        UPDATE stock_levels 
        SET quantity = quantity - ${quantity}, updated_at = NOW()
        WHERE item_id = ${item_id} AND warehouse_id = ${warehouse_id}
      `;

      // Get updated stock level
      const stockLevel = await sql`
        SELECT sl.quantity, i.sku, i.product, w.name as warehouse_name
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        JOIN warehouses w ON sl.warehouse_id = w.id
        WHERE sl.item_id = ${item_id} AND sl.warehouse_id = ${warehouse_id}
      `;

      await sql`COMMIT`;

      return NextResponse.json({ 
        success: true, 
        message: `Dispatched ${quantity} units. New stock: ${stockLevel[0].quantity}`,
        movement_id: movement[0].id,
        new_quantity: stockLevel[0].quantity
      });

    } catch (err) {
      await sql`ROLLBACK`;
      throw err;
    }

  } catch (error) {
    console.error('Error dispatching stock:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to dispatch stock' 
    }, { status: 500 });
  }
}
