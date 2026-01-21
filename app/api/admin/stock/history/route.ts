import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/stock/history - Get stock movement history
// Query params: item_id, warehouse_id, limit, days
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    const days = parseInt(searchParams.get('days') || '30');

    let movements;

    if (item_id) {
      // Get history for specific item
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          i.cost,
          w.name as warehouse_name,
          CASE 
            WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o 
              JOIN sites s ON o.site_id = s.id 
              WHERE o.id = sm.reference_id::integer
            )
            ELSE NULL
          END as site_name,
          CASE 
            WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o 
              WHERE o.id = sm.reference_id::integer
            )
            ELSE NULL
          END as order_number,
          ABS(sm.quantity) * i.cost as stock_value
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.item_id = ${item_id}
          AND sm.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Get all recent movements with site info for order dispatches
      movements = await sql`
        SELECT 
          sm.id,
          sm.item_id,
          sm.warehouse_id,
          sm.movement_type,
          sm.quantity,
          sm.reference_type,
          sm.reference_id,
          sm.reason,
          sm.created_at,
          i.sku,
          i.product,
          i.category,
          i.cost,
          w.name as warehouse_name,
          CASE 
            WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o 
              JOIN sites s ON o.site_id = s.id 
              WHERE o.id = sm.reference_id::integer
            )
            ELSE NULL
          END as site_name,
          CASE 
            WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o 
              WHERE o.id = sm.reference_id::integer
            )
            ELSE NULL
          END as order_number,
          ABS(sm.quantity) * i.cost as stock_value
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    }

    // Get summary stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_movements,
        SUM(CASE WHEN movement_type = 'IN' THEN ABS(quantity) ELSE 0 END) as total_in,
        SUM(CASE WHEN movement_type = 'OUT' THEN ABS(quantity) ELSE 0 END) as total_out,
        SUM(CASE WHEN movement_type = 'IN' THEN ABS(sm.quantity) * i.cost ELSE 0 END) as value_in,
        SUM(CASE WHEN movement_type = 'OUT' THEN ABS(sm.quantity) * i.cost ELSE 0 END) as value_out
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      WHERE sm.created_at >= NOW() - INTERVAL '30 days'
    `;

    return NextResponse.json({ 
      success: true, 
      data: movements,
      stats: stats[0],
      count: movements.length,
      days 
    });

  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch stock history: ' + String(error)
    }, { status: 500 });
  }
}
