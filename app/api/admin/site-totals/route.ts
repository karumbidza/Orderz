import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/site-totals - Get total dispatched value per site
// ─────────────────────────────────────────────
export async function GET() {
  try {
    // Get total dispatched value per site from stock movements linked to orders
    const siteTotals = await sql`
      SELECT 
        s.id as site_id,
        s.site_code,
        s.name as site_name,
        s.city,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(ABS(sm.quantity)), 0) as total_items_dispatched,
        COALESCE(SUM(ABS(sm.quantity) * i.cost::numeric), 0) as total_value_dispatched,
        MAX(sm.created_at) as last_dispatch_date
      FROM sites s
      LEFT JOIN orders o ON o.site_id = s.id AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
      LEFT JOIN stock_movements sm ON sm.reference_type = 'ORDER' AND sm.reference_id = o.id::text AND sm.movement_type = 'OUT'
      LEFT JOIN items i ON sm.item_id = i.id
      GROUP BY s.id, s.site_code, s.name, s.city
      ORDER BY total_value_dispatched DESC
    `;

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
