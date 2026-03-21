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
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10);
  const dateTo = searchParams.get('to') ||
    new Date().toISOString().slice(0,10);
  const siteFilter = searchParams.get('site');

  try {
    const rows = await sql`
      SELECT
        s.name as site_name,
        s.city,
        s.address,
        o.category,
        oi.item_name,
        oi.sku,
        SUM(oi.quantity) as total_qty,
        oi.unit_cost,
        SUM(oi.line_total) as line_total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN sites s ON o.site_id = s.id
      WHERE o.status IN ('RECEIVED','DISPATCHED','PARTIAL_DISPATCH')
        AND o.order_date::date >= ${dateFrom}::date
        AND o.order_date::date <= ${dateTo}::date
        ${siteFilter ? sql`AND s.name ILIKE ${'%' + siteFilter + '%'}` : sql``}
      GROUP BY s.name, s.city, s.address, o.category, oi.item_name, oi.sku, oi.unit_cost
      ORDER BY s.name, o.category, oi.item_name
    `;

    return NextResponse.json({ success: true, data: rows, period: { from: dateFrom, to: dateTo } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
