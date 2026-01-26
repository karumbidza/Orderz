import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// DELETE /api/admin/clear-stock - Clear all stock data
export async function DELETE() {
  try {
    // Delete stock movements first
    const movements = await sql`DELETE FROM stock_movements RETURNING item_id`;
    
    // Delete stock levels
    const levels = await sql`DELETE FROM stock_levels RETURNING item_id`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'All stock data cleared',
      deleted: {
        stock_movements: movements.length,
        stock_levels: levels.length
      }
    });
  } catch (error) {
    console.error('Error clearing stock:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear stock: ' + String(error) }, { status: 500 });
  }
}
