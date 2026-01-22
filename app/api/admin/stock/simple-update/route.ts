import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Simple endpoint that does exactly what dispatch does for ONE item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, qty, order_item_id } = body;
    
    // Exactly like dispatch does:
    const itemId = Number(item_id);
    const qtyToDispatch = Number(qty);
    const orderItemId = Number(order_item_id);
    
    // 1. Get before value
    const beforeStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${itemId} AND warehouse_id = 2`;
    console.log(`BEFORE: item ${itemId} has ${beforeStock[0]?.quantity_on_hand}`);
    
    // 2. Update stock_levels
    const stockResult = await sql`
      UPDATE stock_levels 
      SET quantity_on_hand = quantity_on_hand - ${qtyToDispatch},
          last_updated = NOW()
      WHERE item_id = ${itemId} AND warehouse_id = 2
      RETURNING item_id, quantity_on_hand, last_updated
    `;
    console.log('Stock UPDATE result:', stockResult);
    
    // 3. Verify after
    const afterStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${itemId} AND warehouse_id = 2`;
    console.log(`AFTER: item ${itemId} has ${afterStock[0]?.quantity_on_hand}`);
    
    // 4. Update order_items
    const orderItemResult = await sql`
      UPDATE order_items 
      SET qty_dispatched = COALESCE(qty_dispatched, 0) + ${qtyToDispatch}
      WHERE id = ${orderItemId}
      RETURNING id, qty_dispatched
    `;
    console.log('Order item UPDATE result:', orderItemResult);
    
    // 5. Insert stock movement
    const movementResult = await sql`
      INSERT INTO stock_movements (item_id, warehouse_id, quantity, movement_type, reference_type, reference_id, reason, created_at)
      VALUES (
        ${itemId},
        2,
        ${-qtyToDispatch},
        'OUT',
        'ORDER',
        'TEST',
        'Simple update test',
        NOW()
      )
      RETURNING id
    `;
    console.log('Movement INSERT result:', movementResult);
    
    return NextResponse.json({
      success: true,
      stock_before: beforeStock[0]?.quantity_on_hand,
      stock_update_result: stockResult,
      stock_after: afterStock[0]?.quantity_on_hand,
      order_item_result: orderItemResult,
      movement_result: movementResult
    });
  } catch (error) {
    console.error('Simple update error:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
