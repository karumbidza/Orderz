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
  const category = searchParams.get('category');
  const site = searchParams.get('site');

  try {
    const rows = await sql`
      SELECT
        i.category,
        i.product,
        i.sku,
        i.unit,
        SUM(ABS(sm.quantity)) as total_qty,
        i.cost::numeric as unit_cost,
        SUM(ABS(sm.quantity)) * i.cost::numeric as total_cost
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      LEFT JOIN orders ord
        ON sm.reference_type = 'ORDER_DISPATCH'
        AND sm.reference_id = ord.voucher_number
      LEFT JOIN sites s ON ord.site_id = s.id
      WHERE sm.movement_type = 'OUT'
        AND sm.created_at::date >= ${dateFrom}::date
        AND sm.created_at::date <= ${dateTo}::date
        ${category ? sql`AND i.category = ${category}` : sql``}
        ${site ? sql`AND s.name ILIKE ${site}` : sql``}
      GROUP BY i.category, i.product, i.sku, i.unit, i.cost
      ORDER BY i.category, total_cost DESC
    `;

    const grouped: Record<string, { category: string; total_cost: number; items: any[] }> = {};
    for (const row of rows) {
      if (!grouped[row.category]) {
        grouped[row.category] = { category: row.category, total_cost: 0, items: [] };
      }
      grouped[row.category].items.push(row);
      grouped[row.category].total_cost += Number(row.total_cost);
    }

    const result = Object.values(grouped).sort((a, b) => b.total_cost - a.total_cost);

    return NextResponse.json({ success: true, data: result, period: { from: dateFrom, to: dateTo } });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
