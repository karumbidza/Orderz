import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/dashboard - Get comprehensive dashboard analytics
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Default to current month if not specified
    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const fromDate = dateFrom || startOfMonth;
    const toDate = dateTo || today;

    // ─────────────────────────────────────────────
    // ORDER STATISTICS
    // ─────────────────────────────────────────────
    const orderStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'PENDING') as pending_orders,
        COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_orders,
        COUNT(*) FILTER (WHERE status = 'PARTIAL_DISPATCH') as partial_orders,
        COUNT(*) FILTER (WHERE status = 'DISPATCHED') as dispatched_orders,
        COUNT(*) FILTER (WHERE status = 'RECEIVED') as received_orders,
        COUNT(*) FILTER (WHERE status = 'DECLINED') as declined_orders,
        COUNT(*) as total_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status IN ('DISPATCHED', 'RECEIVED')), 0) as fulfilled_value,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'PENDING'), 0) as pending_value,
        COALESCE(SUM(total_amount), 0) as total_order_value
      FROM orders
    `;

    // Orders in date range
    const periodOrders = await sql`
      SELECT 
        COUNT(*) as orders_count,
        COALESCE(SUM(total_amount), 0) as orders_value,
        COUNT(*) FILTER (WHERE status IN ('DISPATCHED', 'RECEIVED')) as fulfilled_count
      FROM orders
      WHERE order_date >= ${fromDate}::date 
        AND order_date < (${toDate}::date + interval '1 day')
    `;

    // ─────────────────────────────────────────────
    // INVENTORY STATISTICS
    // ─────────────────────────────────────────────
    const inventoryStats = await sql`
      SELECT 
        COUNT(DISTINCT i.id) as total_items,
        COUNT(DISTINCT i.id) FILTER (WHERE COALESCE(sl.quantity_on_hand, 0) = 0) as out_of_stock_items,
        COUNT(DISTINCT i.id) FILTER (WHERE COALESCE(sl.quantity_on_hand, 0) > 0 AND COALESCE(sl.quantity_on_hand, 0) <= 5) as low_stock_items,
        COUNT(DISTINCT i.id) FILTER (WHERE COALESCE(sl.quantity_on_hand, 0) > 5) as healthy_stock_items,
        COALESCE(SUM(sl.quantity_on_hand), 0) as total_quantity,
        COALESCE(SUM(sl.quantity_on_hand * i.cost), 0) as total_stock_value
      FROM items i
      LEFT JOIN stock_levels sl ON i.id = sl.item_id AND sl.warehouse_id = 2
      WHERE i.is_active = true
    `;

    // Stock value by category
    const stockByCategory = await sql`
      SELECT 
        i.category,
        COUNT(DISTINCT i.id) as item_count,
        COALESCE(SUM(sl.quantity_on_hand), 0) as total_qty,
        COALESCE(SUM(sl.quantity_on_hand * i.cost), 0) as stock_value
      FROM items i
      LEFT JOIN stock_levels sl ON i.id = sl.item_id AND sl.warehouse_id = 2
      WHERE i.is_active = true
      GROUP BY i.category
      ORDER BY stock_value DESC
    `;

    // ─────────────────────────────────────────────
    // LOW STOCK / REORDER ITEMS (items with qty <= 5)
    // ─────────────────────────────────────────────
    const lowStockItems = await sql`
      SELECT 
        i.id,
        i.sku,
        i.product,
        i.category,
        i.size,
        i.role,
        i.unit,
        i.cost,
        COALESCE(sl.quantity_on_hand, 0) as quantity_on_hand,
        5 as reorder_level,
        CASE 
          WHEN COALESCE(sl.quantity_on_hand, 0) = 0 THEN 'OUT_OF_STOCK'
          WHEN COALESCE(sl.quantity_on_hand, 0) <= 5 THEN 'LOW_STOCK'
          ELSE 'OK'
        END as stock_status
      FROM items i
      LEFT JOIN stock_levels sl ON i.id = sl.item_id AND sl.warehouse_id = 2
      WHERE i.is_active = true
        AND COALESCE(sl.quantity_on_hand, 0) <= 5
      ORDER BY sl.quantity_on_hand ASC, i.category, i.product
      LIMIT 50
    `;

    // ─────────────────────────────────────────────
    // STOCK MOVEMENT STATISTICS
    // ─────────────────────────────────────────────
    const movementStats = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE movement_type = 'IN') as total_in_movements,
        COUNT(*) FILTER (WHERE movement_type = 'OUT') as total_out_movements,
        COUNT(*) FILTER (WHERE movement_type = 'DAMAGE') as total_damage_movements,
        COUNT(*) FILTER (WHERE movement_type = 'ADJUSTMENT') as total_adjustments,
        COALESCE(SUM(quantity) FILTER (WHERE movement_type = 'IN'), 0) as total_qty_in,
        COALESCE(SUM(ABS(quantity)) FILTER (WHERE movement_type = 'OUT'), 0) as total_qty_out,
        COALESCE(SUM(ABS(quantity)) FILTER (WHERE movement_type = 'DAMAGE'), 0) as total_qty_damaged
      FROM stock_movements
      WHERE created_at >= ${fromDate}::date 
        AND created_at < (${toDate}::date + interval '1 day')
    `;

    // Movement value in period
    const movementValue = await sql`
      SELECT 
        COALESCE(SUM(ABS(sm.quantity) * i.cost) FILTER (WHERE sm.movement_type = 'IN'), 0) as value_in,
        COALESCE(SUM(ABS(sm.quantity) * i.cost) FILTER (WHERE sm.movement_type = 'OUT'), 0) as value_out,
        COALESCE(SUM(ABS(sm.quantity) * i.cost) FILTER (WHERE sm.movement_type = 'DAMAGE'), 0) as value_damaged
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      WHERE sm.created_at >= ${fromDate}::date 
        AND sm.created_at < (${toDate}::date + interval '1 day')
    `;

    // ─────────────────────────────────────────────
    // TOP MOVING ITEMS (most dispatched)
    // ─────────────────────────────────────────────
    const topMovingItems = await sql`
      SELECT 
        i.sku,
        i.product,
        i.category,
        i.size,
        SUM(ABS(sm.quantity)) as total_qty_moved,
        COUNT(DISTINCT sm.reference_id) as order_count,
        COALESCE(SUM(ABS(sm.quantity) * i.cost), 0) as total_value
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      WHERE sm.movement_type = 'OUT'
        AND sm.reference_type = 'ORDER'
        AND sm.created_at >= ${fromDate}::date 
        AND sm.created_at < (${toDate}::date + interval '1 day')
      GROUP BY i.id, i.sku, i.product, i.category, i.size
      ORDER BY total_qty_moved DESC
      LIMIT 10
    `;

    // ─────────────────────────────────────────────
    // SITE STATISTICS
    // ─────────────────────────────────────────────
    const siteStats = await sql`
      SELECT 
        COUNT(DISTINCT s.id) as total_sites,
        COUNT(DISTINCT s.id) FILTER (WHERE s.is_active = true) as active_sites,
        COUNT(DISTINCT o.site_id) FILTER (WHERE o.order_date >= ${fromDate}::date AND o.order_date < (${toDate}::date + interval '1 day')) as sites_with_orders
      FROM sites s
      LEFT JOIN orders o ON s.id = o.site_id
    `;

    // Top ordering sites
    const topSites = await sql`
      SELECT 
        s.name as site_name,
        s.city,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_amount), 0) as total_value
      FROM sites s
      JOIN orders o ON s.id = o.site_id
      WHERE o.order_date >= ${fromDate}::date 
        AND o.order_date < (${toDate}::date + interval '1 day')
      GROUP BY s.id, s.name, s.city
      ORDER BY total_value DESC
      LIMIT 10
    `;

    // ─────────────────────────────────────────────
    // RECENT PENDING ORDERS
    // ─────────────────────────────────────────────
    const pendingOrders = await sql`
      SELECT 
        o.id,
        o.voucher_number,
        o.category,
        o.total_amount,
        o.order_date,
        s.name as site_name,
        s.city,
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.status = 'PENDING'
      ORDER BY o.order_date DESC
      LIMIT 10
    `;

    // ─────────────────────────────────────────────
    // DAILY ORDER TREND (last 7 days)
    // ─────────────────────────────────────────────
    const orderTrend = await sql`
      SELECT 
        DATE(order_date) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as order_value
      FROM orders
      WHERE order_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(order_date)
      ORDER BY date DESC
    `;

    // ─────────────────────────────────────────────
    // CATEGORY ORDER BREAKDOWN
    // ─────────────────────────────────────────────
    const categoryOrders = await sql`
      SELECT 
        category,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_value
      FROM orders
      WHERE order_date >= ${fromDate}::date 
        AND order_date < (${toDate}::date + interval '1 day')
      GROUP BY category
      ORDER BY total_value DESC
    `;

    return NextResponse.json({
      success: true,
      data: {
        period: {
          from: fromDate,
          to: toDate
        },
        orders: {
          ...orderStats[0],
          period: periodOrders[0]
        },
        inventory: {
          ...inventoryStats[0],
          by_category: stockByCategory
        },
        low_stock: {
          count: lowStockItems.length,
          items: lowStockItems
        },
        movements: {
          ...movementStats[0],
          value: movementValue[0]
        },
        top_moving_items: topMovingItems,
        sites: {
          ...siteStats[0],
          top_sites: topSites
        },
        pending_orders: pendingOrders,
        order_trend: orderTrend,
        category_orders: categoryOrders,
        generated_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch dashboard data: ' + String(error)
    }, { status: 500 });
  }
}
