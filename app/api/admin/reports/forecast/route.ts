// ORDERZ-REPORTS
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const lookbackDays = parseInt(searchParams.get('days') || '90');
  const forecastDays = parseInt(searchParams.get('forecast') || '30');

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
        COALESCE(
          (SELECT SUM(ABS(sm.quantity))
           FROM stock_movements sm
           WHERE sm.item_id = i.id
             AND sm.movement_type = 'OUT'
             AND sm.created_at > NOW() - (${lookbackDays}::text || ' days')::interval
          ), 0
        ) as usage_in_period,
        ROUND(COALESCE(
          (SELECT SUM(ABS(sm.quantity))::float / ${lookbackDays}
           FROM stock_movements sm
           WHERE sm.item_id = i.id
             AND sm.movement_type = 'OUT'
             AND sm.created_at > NOW() - (${lookbackDays}::text || ' days')::interval
          ), 0
        )::numeric, 2) as avg_daily_usage,
        ROUND(COALESCE(
          (SELECT SUM(ABS(sm.quantity))::float / ${lookbackDays} * ${forecastDays}
           FROM stock_movements sm
           WHERE sm.item_id = i.id
             AND sm.movement_type = 'OUT'
             AND sm.created_at > NOW() - (${lookbackDays}::text || ' days')::interval
          ), 0
        )::numeric, 0) as forecast_demand,
        GREATEST(0, ROUND(
          COALESCE(
            (SELECT SUM(ABS(sm.quantity))::float / ${lookbackDays} * ${forecastDays}
             FROM stock_movements sm
             WHERE sm.item_id = i.id
               AND sm.movement_type = 'OUT'
               AND sm.created_at > NOW() - (${lookbackDays}::text || ' days')::interval
            ), 0
          )::numeric, 0
        ) - COALESCE(sl.quantity_on_hand, 0) + i.reorder_level) as suggested_order_qty
      FROM items i
      LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = 2
      WHERE i.is_active = true
      ORDER BY i.category, i.product
    `;

    const filtered = rows.filter(r => Number(r.suggested_order_qty) > 0);
    const totalOrderValue = filtered.reduce((sum, r) => sum + Number(r.suggested_order_qty) * Number(r.cost), 0);

    return NextResponse.json({
      success: true,
      items: filtered,
      total_order_value: totalOrderValue,
      lookback_days: lookbackDays,
      forecast_days: forecastDays,
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
