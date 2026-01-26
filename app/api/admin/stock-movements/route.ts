import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/stock-movements - Get stock movement history
// Query params: item_id, warehouse_id, movement_type, limit
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');
    const warehouse_id = searchParams.get('warehouse_id');
    const movement_type = searchParams.get('movement_type');
    const limit = parseInt(searchParams.get('limit') || '100');

    let movements;

    if (item_id && warehouse_id) {
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.item_id = ${item_id} AND sm.warehouse_id = ${warehouse_id}
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else if (item_id) {
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.item_id = ${item_id}
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else if (warehouse_id) {
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.warehouse_id = ${warehouse_id}
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else if (movement_type) {
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.movement_type = ${movement_type}
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      // All movements
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({
      success: true,
      data: movements,
      count: movements.length
    });

  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch stock movements: ' + String(error)
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/stock-movements - Create stock movement
// Supports: IN, OUT, RETURN, DAMAGE, ADJUSTMENT, TRANSFER
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      item_id, 
      warehouse_id, 
      movement_type, 
      quantity, 
      reason, 
      reference_type, 
      reference_id,
      to_warehouse_id, // For transfers
      created_by // User who performed the action
    } = body;

    // Validate required fields
    if (!item_id || !warehouse_id || !movement_type || !quantity) {
      return NextResponse.json({
        success: false,
        error: 'item_id, warehouse_id, movement_type, and quantity are required'
      }, { status: 400 });
    }

    // Validate movement type
    const validTypes = ['IN', 'OUT', 'RETURN', 'DAMAGE', 'ADJUSTMENT', 'TRANSFER'];
    if (!validTypes.includes(movement_type)) {
      return NextResponse.json({
        success: false,
        error: `Invalid movement_type. Must be one of: ${validTypes.join(', ')}`
      }, { status: 400 });
    }

    // Check stock availability for OUT movements
    if (['OUT', 'DAMAGE', 'TRANSFER'].includes(movement_type)) {
      const currentStock = await sql`
        SELECT quantity_on_hand FROM stock_levels 
        WHERE item_id = ${item_id} AND warehouse_id = ${warehouse_id}
      `;

      if (currentStock.length === 0 || currentStock[0].quantity_on_hand < Math.abs(quantity)) {
        return NextResponse.json({
          success: false,
          error: `Insufficient stock. Available: ${currentStock[0]?.quantity_on_hand || 0}, Requested: ${Math.abs(quantity)}`
        }, { status: 400 });
      }
    }

    // For TRANSFER, validate destination warehouse
    if (movement_type === 'TRANSFER' && !to_warehouse_id) {
      return NextResponse.json({
        success: false,
        error: 'to_warehouse_id is required for TRANSFER movements'
      }, { status: 400 });
    }

    // Determine quantity sign based on movement type
    let adjustedQuantity = quantity;
    if (['OUT', 'DAMAGE'].includes(movement_type)) {
      adjustedQuantity = -Math.abs(quantity);
    } else if (['IN', 'RETURN', 'ADJUSTMENT'].includes(movement_type)) {
      adjustedQuantity = Math.abs(quantity);
    }

    // Create movement record
    const movement = await sql`
      INSERT INTO stock_movements 
        (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
      VALUES 
        (${item_id}, ${warehouse_id}, ${movement_type}, ${adjustedQuantity}, 
         ${reference_type || 'MANUAL'}, ${reference_id || null}, ${reason || ''}, ${created_by || 'Admin'}, NOW())
      RETURNING id, item_id, warehouse_id, movement_type, quantity, created_at
    `;

    // Handle TRANSFER - create corresponding IN movement at destination
    if (movement_type === 'TRANSFER' && to_warehouse_id) {
      await sql`
        INSERT INTO stock_movements 
          (item_id, warehouse_id, movement_type, quantity, reference_type, reference_id, reason, created_by, created_at)
        VALUES 
          (${item_id}, ${to_warehouse_id}, 'IN', ${Math.abs(quantity)}, 
           'TRANSFER', ${movement[0].id.toString()}, ${`Transfer from warehouse ${warehouse_id}`}, ${created_by || 'Admin'}, NOW())
      `;

      // Stock level for destination is automatically updated by database trigger
    }

    // Stock level is automatically updated by database trigger (trg_update_stock_after_movement)

    // Get updated stock level
    const stockLevel = await sql`
      SELECT quantity_on_hand FROM stock_levels 
      WHERE item_id = ${item_id} AND warehouse_id = ${warehouse_id}
    `;

    return NextResponse.json({
      success: true,
      message: `${movement_type} movement created. New stock: ${stockLevel[0].quantity_on_hand}`,
      movement_id: movement[0].id,
      new_quantity: stockLevel[0].quantity_on_hand
    });

  } catch (error) {
    console.error('Error creating stock movement:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create stock movement: ' + String(error)
    }, { status: 500 });
  }
}
