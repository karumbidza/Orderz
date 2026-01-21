import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// POST /api/admin/orders/[id]/decline - Decline/Cancel an order
// ─────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const reason = body.reason || 'No reason provided';

    // Get order
    const orderResult = await sql`
      SELECT id, voucher_number, status FROM orders WHERE id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = orderResult[0];

    if (order.status === 'DISPATCHED' || order.status === 'RECEIVED') {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot decline order that is already ${order.status.toLowerCase()}` 
      }, { status: 400 });
    }

    // Update order status to DECLINED
    await sql`
      UPDATE orders 
      SET status = 'DECLINED',
          notes = COALESCE(notes, '') || ' | Declined: ' || ${reason},
          updated_at = NOW()
      WHERE id = ${orderId}
    `;

    return NextResponse.json({
      success: true,
      message: 'Order declined',
      data: {
        order_id: orderId,
        voucher_number: order.voucher_number,
        new_status: 'DECLINED',
        reason
      }
    });

  } catch (error) {
    console.error('Error declining order:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to decline order' 
    }, { status: 500 });
  }
}
