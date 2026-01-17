import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { getSearchParams } from '@/lib/api-utils';

// ─────────────────────────────────────────────
// GET /api/excel/orders - Excel-optimized orders export
// Returns denormalized order data with items
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    const format = params.get('format') || 'json';
    const siteCode = params.get('site');
    const status = params.get('status');
    
    let whereClause = 'WHERE 1=1';
    const conditions: string[] = [];
    
    // Build dynamic query based on filters
    let orders;
    
    if (siteCode && status) {
      orders = await sql`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.status,
          s.code as site_code,
          s.name as site_name,
          w.code as warehouse_code,
          w.name as warehouse_name,
          COALESCE(o.ordered_by, '') as ordered_by,
          o.ordered_at,
          COALESCE(o.approved_by, '') as approved_by,
          o.approved_at,
          oi.id as line_id,
          i.sku as item_sku,
          i.product as item_product,
          i.category as item_category,
          oi.quantity_ordered,
          oi.quantity_fulfilled,
          oi.unit_cost::float as unit_cost,
          (oi.quantity_ordered * oi.unit_cost)::float as line_total
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE s.code = ${siteCode} AND o.status = ${status}::order_status
        ORDER BY o.ordered_at DESC, o.id, oi.id
      `;
    } else if (siteCode) {
      orders = await sql`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.status,
          s.code as site_code,
          s.name as site_name,
          w.code as warehouse_code,
          w.name as warehouse_name,
          COALESCE(o.ordered_by, '') as ordered_by,
          o.ordered_at,
          COALESCE(o.approved_by, '') as approved_by,
          o.approved_at,
          oi.id as line_id,
          i.sku as item_sku,
          i.product as item_product,
          i.category as item_category,
          oi.quantity_ordered,
          oi.quantity_fulfilled,
          oi.unit_cost::float as unit_cost,
          (oi.quantity_ordered * oi.unit_cost)::float as line_total
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE s.code = ${siteCode}
        ORDER BY o.ordered_at DESC, o.id, oi.id
      `;
    } else if (status) {
      orders = await sql`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.status,
          s.code as site_code,
          s.name as site_name,
          w.code as warehouse_code,
          w.name as warehouse_name,
          COALESCE(o.ordered_by, '') as ordered_by,
          o.ordered_at,
          COALESCE(o.approved_by, '') as approved_by,
          o.approved_at,
          oi.id as line_id,
          i.sku as item_sku,
          i.product as item_product,
          i.category as item_category,
          oi.quantity_ordered,
          oi.quantity_fulfilled,
          oi.unit_cost::float as unit_cost,
          (oi.quantity_ordered * oi.unit_cost)::float as line_total
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE o.status = ${status}::order_status
        ORDER BY o.ordered_at DESC, o.id, oi.id
      `;
    } else {
      orders = await sql`
        SELECT 
          o.id as order_id,
          o.order_number,
          o.status,
          s.code as site_code,
          s.name as site_name,
          w.code as warehouse_code,
          w.name as warehouse_name,
          COALESCE(o.ordered_by, '') as ordered_by,
          o.ordered_at,
          COALESCE(o.approved_by, '') as approved_by,
          o.approved_at,
          oi.id as line_id,
          i.sku as item_sku,
          i.product as item_product,
          i.category as item_category,
          oi.quantity_ordered,
          oi.quantity_fulfilled,
          oi.unit_cost::float as unit_cost,
          (oi.quantity_ordered * oi.unit_cost)::float as line_total
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        JOIN warehouses w ON o.warehouse_id = w.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN items i ON oi.item_id = i.id
        ORDER BY o.ordered_at DESC, o.id, oi.id
        LIMIT 1000
      `;
    }
    
    if (format === 'csv') {
      const headers = [
        'order_id', 'order_number', 'status', 'site_code', 'site_name',
        'warehouse_code', 'warehouse_name', 'ordered_by', 'ordered_at',
        'approved_by', 'approved_at', 'line_id', 'item_sku', 'item_product',
        'item_category', 'quantity_ordered', 'quantity_fulfilled', 'unit_cost', 'line_total'
      ];
      const rows = orders.map((row: Record<string, unknown>) => 
        headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="orders.csv"',
        },
      });
    }
    
    return Response.json(orders);
  } catch (error) {
    console.error('Excel orders export error:', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
