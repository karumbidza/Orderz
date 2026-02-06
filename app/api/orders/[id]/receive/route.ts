import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// PATCH /api/orders/[id]/receive - Mark order as received by site
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ error: 'Invalid order ID' }, { status: 400 });
    }
    
    // Get request body for received_by name
    const body = await request.json();
    const receivedBy = body.received_by || 'Site User';
    
    // Check order exists and is in DISPATCHED status
    const orders = await sql`
      SELECT id, status, voucher_number
      FROM orders
      WHERE id = ${orderId}
    `;
    
    if (orders.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    
    const order = orders[0];
    
    // Only allow marking as received if status is DISPATCHED
    if (order.status !== 'DISPATCHED') {
      return NextResponse.json({ 
        error: `Order cannot be marked as received. Current status: ${order.status}. Only DISPATCHED orders can be marked as received.` 
      }, { status: 400 });
    }
    
    // Update order status to RECEIVED
    await sql`
      UPDATE orders
      SET 
        status = 'RECEIVED',
        received_at = NOW(),
        received_by = ${receivedBy},
        updated_at = NOW()
      WHERE id = ${orderId}
    `;
    
    return NextResponse.json({
      success: true,
      message: `Order ${order.voucher_number} marked as received`,
      order_id: orderId,
      received_by: receivedBy,
      received_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error marking order as received:', error);
    return NextResponse.json({ error: 'Failed to mark order as received' }, { status: 500 });
  }
}
