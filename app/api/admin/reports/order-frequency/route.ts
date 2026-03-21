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
    const rows = await sql`
      SELECT
        s.name as site_name,
        s.city,
        o.category,
        DATE_TRUNC('month', o.order_date) as month,
        COUNT(*) as order_count,
        SUM(o.total_amount) as monthly_spend,
        AVG(o.total_amount) as avg_order_value
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.order_date::date >= ${dateFrom}::date
        AND o.order_date::date <= ${dateTo}::date
      GROUP BY s.name, s.city, o.category, DATE_TRUNC('month', o.order_date)
      ORDER BY s.name, month DESC
    `;

    return NextResponse.json({ success: true, data: rows, period: { from: dateFrom, to: dateTo } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
