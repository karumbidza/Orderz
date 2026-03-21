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
        i.id,
        i.sku,
        i.product,
        i.category,
        i.size,
        i.role,
        i.unit,
        i.cost::numeric as cost,
        i.reorder_level,
        i.lead_time_days,
        COALESCE(sl.quantity_on_hand, 0) as current_stock,
        COALESCE(sl.quantity_on_hand, 0) - i.reorder_level as stock_vs_reorder,
        COALESCE(
          (SELECT SUM(ABS(sm.quantity))::float / 30
           FROM stock_movements sm
           WHERE sm.item_id = i.id
             AND sm.movement_type = 'OUT'
             AND sm.created_at > NOW() - INTERVAL '30 days'
          ), 0
        ) as avg_daily_usage,
        CASE
          WHEN COALESCE(
            (SELECT SUM(ABS(sm.quantity))::float / 30
             FROM stock_movements sm
             WHERE sm.item_id = i.id
               AND sm.movement_type = 'OUT'
               AND sm.created_at > NOW() - INTERVAL '30 days'
            ), 0
          ) > 0
          THEN ROUND(
            COALESCE(sl.quantity_on_hand, 0)::float /
            (SELECT SUM(ABS(sm.quantity))::float / 30
             FROM stock_movements sm
             WHERE sm.item_id = i.id
               AND sm.movement_type = 'OUT'
               AND sm.created_at > NOW() - INTERVAL '30 days'
            )
          )
          ELSE NULL
        END as days_until_stockout
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = 2
      WHERE i.is_active = true
        AND i.reorder_level > 0
        AND COALESCE(sl.quantity_on_hand, 0) <= i.reorder_level
      ORDER BY stock_vs_reorder ASC, i.category
    `;

    return NextResponse.json({ success: true, items: rows, count: rows.length });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
