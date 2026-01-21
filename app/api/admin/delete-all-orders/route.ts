import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function DELETE() {
  try {
    // Delete order items first (foreign key constraint)
    const items = await sql`DELETE FROM order_items RETURNING id`;
    
    // Delete orders
    const orders = await sql`DELETE FROM orders RETURNING id`;
    
    // Reset the voucher sequence
    await sql`DELETE FROM voucher_sequences WHERE id = 1`;
    await sql`INSERT INTO voucher_sequences (id, prefix, year, last_number) VALUES (1, 'RV', 2026, 0) ON CONFLICT (id) DO UPDATE SET last_number = 0`;
    
    return NextResponse.json({ 
      success: true, 
      message: 'All orders deleted',
      deleted: {
        order_items: items.length,
        orders: orders.length
      }
    });
  } catch (error) {
    console.error('Error deleting orders:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete orders' }, { status: 500 });
  }
}
