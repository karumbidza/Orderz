import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Test endpoint to debug stock updates
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, qty } = body;
    
    // Get before value
    const before = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    
    // Update
    const result = await sql`
      UPDATE stock_levels 
      SET quantity_on_hand = quantity_on_hand - ${qty},
          last_updated = NOW()
      WHERE item_id = ${item_id} AND warehouse_id = 2
      RETURNING item_id, quantity_on_hand, last_updated
    `;
    
    // Get after value  
    const after = await sql`SELECT quantity_on_hand FROM stock_levels WHERE item_id = ${item_id} AND warehouse_id = 2`;
    
    return NextResponse.json({
      success: true,
      before: before[0]?.quantity_on_hand,
      result: result,
      after: after[0]?.quantity_on_hand
    });
  } catch (error) {
    console.error('Test update error:', error);
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
