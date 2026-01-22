import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// Simple endpoint that does exactly what dispatch does for ONE item
export async function POST(request: NextRequest) {
  // Create sql function locally, fresh for each request
  const sql = neon(process.env.DATABASE_URL!);
  
  try {
    const body = await request.json();
    const { item_id, qty, order_item_id } = body;
    
    // Get before value
    const beforeStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    console.log(`BEFORE: item ${item_id} has ${beforeStock[0]?.quantity_on_hand}`);
    
    // Use sql.transaction() to batch all mutations together using callback syntax
    const txnResults = await sql.transaction((txn) => [
      txn`
        UPDATE stock_levels 
        SET quantity_on_hand = quantity_on_hand - ${qty},
            last_updated = NOW()
        WHERE item_id = ${item_id} AND warehouse_id = 2
        RETURNING item_id, quantity_on_hand, last_updated
      `,
      txn`
        UPDATE order_items 
        SET qty_dispatched = COALESCE(qty_dispatched, 0) + 0
        WHERE id = 136
        RETURNING id, qty_dispatched
      `,
      txn`
        INSERT INTO stock_movements (item_id, warehouse_id, quantity, movement_type, reference_type, reference_id, reason, created_at)
        VALUES (73, 2, -1, 'OUT', 'ORDER', 'TEST5-CBK', 'Test with callback transaction', NOW())
        RETURNING id
      `
    ]);
    const [stockResult, orderItemResult, movementResult] = txnResults;
    console.log('Transaction results:', { stockResult, orderItemResult, movementResult });
    
    // Verify after
    const afterStock = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    console.log(`AFTER: item ${item_id} has ${afterStock[0]?.quantity_on_hand}`);

    return NextResponse.json({
      success: true,
      stock_before: beforeStock[0]?.quantity_on_hand,
      stock_update_result: stockResult,
      stock_after: afterStock[0]?.quantity_on_hand,
      note: 'Using sql.transaction() for all mutations',
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
