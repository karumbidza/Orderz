import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/site-totals - Get total dispatched value per site
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // Get date filters from query params
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query with optional date filters
    let siteTotals;
    
    if (dateFrom && dateTo) {
      siteTotals = await sql`
        SELECT 
          s.id as site_id,
          s.site_code,
          s.name as site_name,
          s.city,
          COUNT(DISTINCT o.id)::int as total_orders,
          COALESCE(SUM(oi.qty_dispatched), 0)::int as total_items_dispatched,
          COALESCE(SUM(oi.qty_dispatched * oi.unit_cost), 0)::numeric as total_value_dispatched,
          MAX(o.dispatched_at) as last_dispatch_date
        FROM sites s
        LEFT JOIN orders o ON o.site_id = s.id 
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND o.dispatched_at >= ${dateFrom}::date
          AND o.dispatched_at < (${dateTo}::date + interval '1 day')
        LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.qty_dispatched > 0
        GROUP BY s.id, s.site_code, s.name, s.city
        ORDER BY total_value_dispatched DESC
      `;
    } else if (dateFrom) {
      siteTotals = await sql`
        SELECT 
          s.id as site_id,
          s.site_code,
          s.name as site_name,
          s.city,
          COUNT(DISTINCT o.id)::int as total_orders,
          COALESCE(SUM(oi.qty_dispatched), 0)::int as total_items_dispatched,
          COALESCE(SUM(oi.qty_dispatched * oi.unit_cost), 0)::numeric as total_value_dispatched,
          MAX(o.dispatched_at) as last_dispatch_date
        FROM sites s
        LEFT JOIN orders o ON o.site_id = s.id 
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND o.dispatched_at >= ${dateFrom}::date
        LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.qty_dispatched > 0
        GROUP BY s.id, s.site_code, s.name, s.city
        ORDER BY total_value_dispatched DESC
      `;
    } else if (dateTo) {
      siteTotals = await sql`
        SELECT 
          s.id as site_id,
          s.site_code,
          s.name as site_name,
          s.city,
          COUNT(DISTINCT o.id)::int as total_orders,
          COALESCE(SUM(oi.qty_dispatched), 0)::int as total_items_dispatched,
          COALESCE(SUM(oi.qty_dispatched * oi.unit_cost), 0)::numeric as total_value_dispatched,
          MAX(o.dispatched_at) as last_dispatch_date
        FROM sites s
        LEFT JOIN orders o ON o.site_id = s.id 
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND o.dispatched_at < (${dateTo}::date + interval '1 day')
        LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.qty_dispatched > 0
        GROUP BY s.id, s.site_code, s.name, s.city
        ORDER BY total_value_dispatched DESC
      `;
    } else {
      siteTotals = await sql`
        SELECT 
          s.id as site_id,
          s.site_code,
          s.name as site_name,
          s.city,
          COUNT(DISTINCT o.id)::int as total_orders,
          COALESCE(SUM(oi.qty_dispatched), 0)::int as total_items_dispatched,
          COALESCE(SUM(oi.qty_dispatched * oi.unit_cost), 0)::numeric as total_value_dispatched,
          MAX(o.dispatched_at) as last_dispatch_date
        FROM sites s
        LEFT JOIN orders o ON o.site_id = s.id AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
        LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.qty_dispatched > 0
        GROUP BY s.id, s.site_code, s.name, s.city
        ORDER BY total_value_dispatched DESC
      `;
    }

    return NextResponse.json({ 
      success: true, 
      data: siteTotals,
      count: siteTotals.length
    });
  } catch (error) {
    console.error('Error fetching site totals:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch site totals: ' + String(error)
    }, { status: 500 });
  }
}
