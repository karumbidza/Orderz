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
        o.order_number,
        o.status,
        o.total_amount,
        o.created_at,
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

    // Get order items with item details
    const items = await sql`
      SELECT 
        oi.id,
        oi.quantity,
        oi.unit_cost,
        oi.total_cost,
        i.sku,
        i.product,
        i.category,
        i.role,
        i.size,
        i.unit
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      WHERE oi.order_id = ${orderId}
      ORDER BY i.category, i.product, i.size
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
    return NextResponse.json({ success: false, error: 'Failed to fetch order details' }, { status: 500 });
  }
}
