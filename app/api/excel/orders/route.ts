import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { getSearchParams, successResponse, errorResponse } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

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

// ─────────────────────────────────────────────
// POST /api/excel/orders - Submit new order from Excel
// Expected payload from VBA:
// {
//   "voucher_number": "ORD-2025-001",
//   "site_code": "HAR-001",
//   "category": "Uniforms",
//   "ordered_by": "John Doe",
//   "notes": "Monthly order",
//   "items": [
//     {"sku": "UNI-001", "quantity": 2, "employee_name": "Jane Smith"},
//     {"sku": "PPE-002", "quantity": 5}
//   ]
// }
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const { 
      voucher_number, 
      site_code, 
      category, 
      ordered_by, 
      notes,
      items 
    } = body;

    // Validate required fields
    if (!site_code) {
      return errorResponse('site_code is required', 400);
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse('At least one item is required', 400);
    }

    // Look up site
    const siteResult = await sql`
      SELECT id, name, city, fulfillment_zone 
      FROM sites 
      WHERE code = ${site_code}
    `;
    
    if (siteResult.length === 0) {
      return errorResponse(`Site not found: ${site_code}`, 404);
    }
    const site = siteResult[0];

    // Get HEAD-OFFICE warehouse
    const warehouseResult = await sql`
      SELECT id FROM warehouses WHERE code = 'HEAD-OFFICE' LIMIT 1
    `;
    
    if (warehouseResult.length === 0) {
      return errorResponse('HEAD-OFFICE warehouse not configured', 500);
    }
    const warehouseId = warehouseResult[0].id;

    // Generate voucher number if not provided
    const voucherNumber = voucher_number || await generateOrderNumber();

    // Create the order - using actual schema columns
    // orders table has: id, voucher_number, category, status, total_amount, order_date, site_id, requested_by, notes, etc.
    const orderResult = await sql`
      INSERT INTO orders (
        voucher_number, 
        site_id, 
        category,
        status, 
        requested_by, 
        notes,
        order_date
      )
      VALUES (
        ${voucherNumber},
        ${site.id},
        ${category || 'General'},
        'PENDING',
        ${ordered_by || null},
        ${notes || null},
        NOW()
      )
      RETURNING id, voucher_number, status, order_date
    `;
    
    const order = orderResult[0];

    // Insert order items
    // order_items has: id, order_id, item_id, sku, item_name, qty_requested, qty_approved, unit_cost, line_total, size, employee_name, notes
    const insertedItems = [];
    const errors = [];

    for (const item of items) {
      const { sku, quantity, employee_name, size } = item;
      
      if (!sku || !quantity) {
        errors.push(`Invalid item: missing sku or quantity`);
        continue;
      }

      // Look up item by SKU
      const itemResult = await sql`
        SELECT id, product, category, size, cost
        FROM items 
        WHERE sku = ${sku}
      `;
      
      if (itemResult.length === 0) {
        errors.push(`Item not found: ${sku}`);
        continue;
      }
      
      const dbItem = itemResult[0];
      const unitCost = parseFloat(dbItem.cost) || 0;
      const lineTotal = unitCost * quantity;

      // Insert order item with correct column names
      const orderItemResult = await sql`
        INSERT INTO order_items (
          order_id,
          item_id,
          sku,
          item_name,
          qty_requested,
          unit_cost,
          line_total,
          size,
          employee_name
        )
        VALUES (
          ${order.id},
          ${dbItem.id},
          ${sku},
          ${dbItem.product},
          ${quantity},
          ${unitCost},
          ${lineTotal},
          ${size || dbItem.size || null},
          ${employee_name || null}
        )
        RETURNING id, sku, item_name, qty_requested, unit_cost, line_total
      `;
      
      insertedItems.push(orderItemResult[0]);
    }

    // Update order total
    const totalAmount = insertedItems.reduce((sum, item) => sum + parseFloat(item.line_total || 0), 0);
    await sql`UPDATE orders SET total_amount = ${totalAmount} WHERE id = ${order.id}`;

    return NextResponse.json({
      success: true,
      data: {
        order_id: order.id,
        voucher_number: order.voucher_number,
        status: order.status,
        site: site.name,
        items_added: insertedItems.length,
        total_amount: totalAmount,
        errors: errors.length > 0 ? errors : undefined
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Order submission failed',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

// Generate unique order number
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of orders this month
  const countResult = await sql`
    SELECT COUNT(*) as cnt FROM orders 
    WHERE order_date >= DATE_TRUNC('month', CURRENT_DATE)
  `;
  
  const sequence = Number(countResult[0].cnt) + 1;
  return `RV-${year}-${String(sequence).padStart(4, '0')}`;
}
