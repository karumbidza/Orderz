// ORDERZ-REPORTS
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  try {
    const rows = await sql`
      SELECT
        i.sku,
        i.product,
        i.category,
        i.size,
        i.cost::numeric as cost,
        COALESCE(sl.quantity_on_hand, 0) as current_stock,
        COALESCE(usage_90.qty, 0) as qty_90_days,
        COALESCE(usage_30.qty, 0) as qty_30_days,
        ROUND(COALESCE(usage_90.qty, 0)::numeric / 90, 2) as avg_daily_usage,
        CASE
          WHEN COALESCE(usage_30.qty, 0) = 0 THEN 'IDLE'
          WHEN COALESCE(usage_30.qty, 0) >= 20 THEN 'FAST'
          WHEN COALESCE(usage_30.qty, 0) >= 5 THEN 'NORMAL'
          ELSE 'SLOW'
        END as velocity
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = 2
      LEFT JOIN (
        SELECT item_id, SUM(ABS(quantity)) as qty
        FROM stock_movements
        WHERE movement_type = 'OUT' AND created_at > NOW() - INTERVAL '90 days'
        GROUP BY item_id
      ) usage_90 ON usage_90.item_id = i.id
      LEFT JOIN (
        SELECT item_id, SUM(ABS(quantity)) as qty
        FROM stock_movements
        WHERE movement_type = 'OUT' AND created_at > NOW() - INTERVAL '30 days'
        GROUP BY item_id
      ) usage_30 ON usage_30.item_id = i.id
      WHERE i.is_active = true
      ORDER BY qty_30_days DESC
    `;

    return NextResponse.json({ success: true, items: rows });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
