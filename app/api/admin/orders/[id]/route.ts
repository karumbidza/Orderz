import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/orders/[id] - Get single order with items
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    // Get order with site info
    const orderResult = await sql`
      SELECT 
        o.id,
        o.voucher_number as order_number,
        o.category,
        o.status,
        o.total_amount,
        o.order_date as created_at,
        o.dispatched_at,
        o.dispatched_by,
        o.received_at,
        o.received_by,
        o.requested_by,
        o.notes,
        s.name as site_name,
        s.site_code,
        s.city
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = orderResult[0];

    // Get order items - order_items has: id, order_id, employee_id, item_id, qty_requested, qty_dispatched, qty_approved, unit_cost, line_total, size, employee_name, notes, sku, item_name
    const items = await sql`
      SELECT 
        oi.id,
        oi.qty_requested as quantity,
        COALESCE(oi.qty_dispatched, 0) as qty_dispatched,
        oi.qty_approved,
        oi.unit_cost,
        oi.line_total as total_cost,
        oi.size,
        oi.employee_name,
        oi.sku,
        oi.item_name as product
      FROM order_items oi
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.item_name, oi.size
    `;

    return NextResponse.json({
      success: true,
      data: {
        ...order,
        items: items,
      },
    });

  } catch (error) {
    console.error('Error fetching order details:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch order details: ' + String(error) }, { status: 500 });
  }
}
// Force rebuild Thu Jan 22 15:05:02 CAT 2026
