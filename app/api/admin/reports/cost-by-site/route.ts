// ORDERZ-REPORTS
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('from') ||
    new Date(Date.now() - 90*24*60*60*1000).toISOString().slice(0,10);
  const dateTo = searchParams.get('to') ||
    new Date().toISOString().slice(0,10);

  try {
    const siteTotals = await sql`
      SELECT
        s.name as site_name,
        s.city,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.total_amount) as total_spend,
        MAX(o.order_date) as last_order_date
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.status IN ('RECEIVED','DISPATCHED','PARTIAL_DISPATCH')
        AND o.order_date::date >= ${dateFrom}::date
        AND o.order_date::date <= ${dateTo}::date
      GROUP BY s.name, s.city
      ORDER BY total_spend DESC
    `;

    const categoryBreakdown = await sql`
      SELECT
        s.name as site_name,
        o.category,
        COUNT(DISTINCT o.id) as order_count,
        SUM(o.total_amount) as category_spend
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.status IN ('RECEIVED','DISPATCHED','PARTIAL_DISPATCH')
        AND o.order_date::date >= ${dateFrom}::date
        AND o.order_date::date <= ${dateTo}::date
      GROUP BY s.name, o.category
      ORDER BY s.name, category_spend DESC
    `;

    return NextResponse.json({
      success: true,
      sites: siteTotals,
      breakdown: categoryBreakdown,
      period: { from: dateFrom, to: dateTo },
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
