import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/order-summary - Simple orders list for Excel R.V Summary
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    
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
          o.created_at,
          o.pdf_filename,
          s.name as site_name,
          s.city as site_city,
          (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN sites s ON o.site_id = s.id
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
          o.created_at,
          o.pdf_filename,
          s.name as site_name,
          s.city as site_city,
          (SELECT COUNT(*)::int FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN sites s ON o.site_id = s.id
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    }
    
    // Get counts by status
    const statusCounts = await sql`
      SELECT 
        status,
        COUNT(*)::int as count
      FROM orders
      GROUP BY status
    `;
    
    const counts: Record<string, number> = {
      PENDING: 0,
      DISPATCHED: 0,
      RECEIVED: 0,
    };
    
    for (const row of statusCounts) {
      counts[row.status as string] = row.count as number;
    }
    
    return Response.json({
      success: true,
      data: orders,
      total: orders.length,
      counts: counts,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching order summary:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch orders',
    }, { status: 500 });
  }
}
