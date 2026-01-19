import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Valid status values
const STATUS_VALUES = ['PENDING', 'PROCESSING', 'DISPATCHED', 'RECEIVED', 'CANCELLED'] as const;

// ─────────────────────────────────────────────
// GET /api/admin/orders - Get all orders for admin
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const status = searchParams.get('status');

    let orders;
    if (status) {
      orders = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.category,
          o.status,
          o.total_amount,
          o.order_date,
          o.requested_by,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.notes,
          s.name as site_name,
          s.city as site_city,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        WHERE o.status = ${status}
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    } else {
      orders = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.category,
          o.status,
          o.total_amount,
          o.order_date,
          o.requested_by,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.notes,
          s.name as site_name,
          s.city as site_city,
          (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch orders' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/orders - Update order status
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { order_id, status, updated_by } = body;

    if (!order_id) {
      return NextResponse.json({ success: false, error: 'order_id is required' }, { status: 400 });
    }

    if (!status || !STATUS_VALUES.includes(status)) {
      return NextResponse.json({ 
        success: false, 
        error: `Invalid status. Must be one of: ${STATUS_VALUES.join(', ')}` 
      }, { status: 400 });
    }

    let result;
    
    if (status === 'DISPATCHED') {
      result = await sql`
        UPDATE orders 
        SET status = ${status}, 
            dispatched_at = NOW(), 
            dispatched_by = ${updated_by || 'Admin'},
            updated_at = NOW()
        WHERE id = ${order_id}
        RETURNING id, voucher_number, status, dispatched_at
      `;
    } else if (status === 'RECEIVED') {
      result = await sql`
        UPDATE orders 
        SET status = ${status}, 
            received_at = NOW(), 
            received_by = ${updated_by || 'Admin'},
            updated_at = NOW()
        WHERE id = ${order_id}
        RETURNING id, voucher_number, status, received_at
      `;
    } else {
      result = await sql`
        UPDATE orders 
        SET status = ${status}, updated_at = NOW()
        WHERE id = ${order_id}
        RETURNING id, voucher_number, status
      `;
    }

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Order ${result[0].voucher_number} updated to ${status}`,
      order: result[0]
    });

  } catch (error) {
    console.error('Error updating order:', error);
    return NextResponse.json({ success: false, error: 'Failed to update order' }, { status: 500 });
  }
}
