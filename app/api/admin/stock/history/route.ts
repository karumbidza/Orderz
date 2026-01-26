import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/stock/history - Get stock movement history
// Query params: item_id, limit, dateFrom, dateTo, category, type
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const item_id = searchParams.get('item_id');
    const itemIdNum = item_id ? parseInt(item_id) : null;
    const limit = parseInt(searchParams.get('limit') || '500');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const category = searchParams.get('category');
    const movementType = searchParams.get('type');

    let movements;

    if (itemIdNum) {
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
          sm.created_by,
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
        WHERE sm.item_id = ${itemIdNum}
        ORDER BY sm.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Build dynamic query based on filters
      if (dateFrom && dateTo && category && movementType) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE sm.created_at >= ${dateFrom}::date
            AND sm.created_at < (${dateTo}::date + interval '1 day')
            AND i.category = ${category}
            AND sm.movement_type = ${movementType}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (dateFrom && dateTo && category) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE sm.created_at >= ${dateFrom}::date
            AND sm.created_at < (${dateTo}::date + interval '1 day')
            AND i.category = ${category}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (dateFrom && dateTo && movementType) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE sm.created_at >= ${dateFrom}::date
            AND sm.created_at < (${dateTo}::date + interval '1 day')
            AND sm.movement_type = ${movementType}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (dateFrom && dateTo) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE sm.created_at >= ${dateFrom}::date
            AND sm.created_at < (${dateTo}::date + interval '1 day')
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (category && movementType) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE i.category = ${category}
            AND sm.movement_type = ${movementType}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (category) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE i.category = ${category}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else if (movementType) {
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          WHERE sm.movement_type = ${movementType}
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      } else {
        // Default: get all movements (no date filter, no 30-day limit)
        movements = await sql`
          SELECT 
            sm.id, sm.item_id, sm.warehouse_id, sm.movement_type, sm.quantity,
            sm.reference_type, sm.reference_id, sm.reason, sm.created_at, sm.created_by,
            i.sku, i.product, i.category, i.cost, w.name as warehouse_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT s.name FROM orders o JOIN sites s ON o.site_id = s.id WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as site_name,
            CASE WHEN sm.reference_type = 'ORDER' THEN (
              SELECT o.voucher_number FROM orders o WHERE o.id = sm.reference_id::integer
            ) ELSE NULL END as order_number,
            ABS(sm.quantity) * i.cost as stock_value
          FROM stock_movements sm
          JOIN items i ON sm.item_id = i.id
          JOIN warehouses w ON sm.warehouse_id = w.id
          ORDER BY sm.created_at DESC
          LIMIT ${limit}
        `;
      }
    }

    // Get unique categories for filter dropdown
    const categories = await sql`
      SELECT DISTINCT i.category 
      FROM stock_movements sm 
      JOIN items i ON sm.item_id = i.id 
      WHERE i.category IS NOT NULL 
      ORDER BY i.category
    `;

    // Get summary stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_movements,
        SUM(CASE WHEN movement_type = 'IN' THEN ABS(quantity) ELSE 0 END) as total_in,
        SUM(CASE WHEN movement_type = 'OUT' THEN ABS(quantity) ELSE 0 END) as total_out,
        SUM(CASE WHEN movement_type = 'DAMAGE' THEN ABS(quantity) ELSE 0 END) as total_damage,
        SUM(CASE WHEN movement_type = 'IN' THEN ABS(sm.quantity) * i.cost ELSE 0 END) as value_in,
        SUM(CASE WHEN movement_type = 'OUT' THEN ABS(sm.quantity) * i.cost ELSE 0 END) as value_out
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
    `;

    return NextResponse.json({ 
      success: true, 
      data: movements,
      categories: categories.map(c => c.category),
      stats: stats[0],
      count: movements.length
    });

  } catch (error) {
    console.error('Error fetching stock history:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch stock history: ' + String(error)
    }, { status: 500 });
  }
}
