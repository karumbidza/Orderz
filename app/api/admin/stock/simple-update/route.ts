import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Simple endpoint that does exactly what dispatch does for ONE item
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, qty, order_item_id } = body;
    
    // Don't use Number() conversion - use params directly like test-update
    
    // 1. Get before value
    const beforeStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    console.log(`BEFORE: item ${item_id} has ${beforeStock[0]?.quantity_on_hand}`);
    
    // 2. Update stock_levels
    const stockResult = await sql`
      UPDATE stock_levels 
      SET quantity_on_hand = quantity_on_hand - ${qty},
          last_updated = NOW()
      WHERE item_id = ${item_id} AND warehouse_id = 2
      RETURNING item_id, quantity_on_hand, last_updated
    `;
    console.log('Stock UPDATE result:', stockResult);
    
    // 3. Verify after
    const afterStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    console.log(`AFTER: item ${item_id} has ${afterStock[0]?.quantity_on_hand}`);
    
    // STOP HERE - just like test-update, only 3 queries
    // Skip order_items update and movement insert
    
    return NextResponse.json({
      success: true,
      stock_before: beforeStock[0]?.quantity_on_hand,
      stock_update_result: stockResult,
      stock_after: afterStock[0]?.quantity_on_hand,
      note: 'Only 3 queries like test-update'
    });
  } catch (error) {
    console.error('Simple update error:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
