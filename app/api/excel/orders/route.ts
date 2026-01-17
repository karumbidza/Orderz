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

    // Generate order number if not provided
    const orderNumber = voucher_number || await generateOrderNumber();

    // Create the order
    const orderResult = await sql`
      INSERT INTO orders (
        order_number, 
        site_id, 
        warehouse_id, 
        status, 
        ordered_by, 
        notes
      )
      VALUES (
        ${orderNumber},
        ${site.id},
        ${warehouseId},
        'PENDING',
        ${ordered_by || null},
        ${notes || null}
      )
      RETURNING id, order_number, status, ordered_at
    `;
    
    const order = orderResult[0];

    // Insert order items
    const insertedItems = [];
    const errors = [];

    for (const item of items) {
      const { sku, quantity, employee_name } = item;
      
      if (!sku || !quantity) {
        errors.push(`Invalid item: missing sku or quantity`);
        continue;
      }

      // Look up item by SKU
      const itemResult = await sql`
        SELECT id, product, category, unit, cost, tracking_type, requires_employee
        FROM items 
        WHERE sku = ${sku}
      `;
      
      if (itemResult.length === 0) {
        errors.push(`Item not found: ${sku}`);
        continue;
      }
      
      const dbItem = itemResult[0];
      
      // Validate employee requirement for uniforms
      if (dbItem.requires_employee && !employee_name) {
        errors.push(`${sku} requires employee name`);
        continue;
      }

      // Insert order item
      const orderItemResult = await sql`
        INSERT INTO order_items (
          order_id,
          item_id,
          quantity_ordered,
          unit_cost,
          notes
        )
        VALUES (
          ${order.id},
          ${dbItem.id},
          ${quantity},
          ${dbItem.cost || 0},
          ${employee_name ? `Employee: ${employee_name}` : null}
        )
        RETURNING id, quantity_ordered, unit_cost
      `;
      
      insertedItems.push({
        line_id: orderItemResult[0].id,
        sku: sku,
        product: dbItem.product,
        quantity: quantity,
        unit_cost: orderItemResult[0].unit_cost,
        employee_name: employee_name || null
      });

      // If this is a uniform with employee, create uniform assignment record
      if (dbItem.category === 'Uniforms' && employee_name) {
        // Try to find or create employee
        let employeeResult = await sql`
          SELECT id FROM employees 
          WHERE LOWER(full_name) = LOWER(${employee_name}) 
          AND site_id = ${site.id}
          LIMIT 1
        `;
        
        if (employeeResult.length === 0) {
          // Auto-create employee record
          employeeResult = await sql`
            INSERT INTO employees (site_id, full_name, department)
            VALUES (${site.id}, ${employee_name}, 'Unknown')
            ON CONFLICT DO NOTHING
            RETURNING id
          `;
        }
        
        if (employeeResult.length > 0) {
          // Create uniform assignment (pending)
          await sql`
            INSERT INTO uniform_assignments (
              employee_id,
              item_id,
              quantity,
              order_id,
              status,
              notes
            )
            VALUES (
              ${employeeResult[0].id},
              ${dbItem.id},
              ${quantity},
              ${order.id},
              'PENDING',
              'Created from Excel order'
            )
          `;
        }
      }
    }

    // Calculate order total
    const totalResult = await sql`
      SELECT COALESCE(SUM(quantity_ordered * unit_cost), 0)::float as total
      FROM order_items
      WHERE order_id = ${order.id}
    `;

    return Response.json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        status: order.status,
        ordered_at: order.ordered_at,
        site_name: site.name,
        site_code: site_code,
        fulfillment_zone: site.fulfillment_zone,
        item_count: insertedItems.length,
        total: totalResult[0].total
      },
      items: insertedItems,
      errors: errors.length > 0 ? errors : undefined
    }, { status: 201 });

  } catch (error) {
    console.error('Excel order submission error:', error);
    return errorResponse('Order submission failed', 500);
  }
}

// Generate unique order number
async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  
  // Get count of orders this month
  const countResult = await sql`
    SELECT COUNT(*) as cnt FROM orders 
    WHERE ordered_at >= DATE_TRUNC('month', CURRENT_DATE)
  `;
  
  const sequence = Number(countResult[0].cnt) + 1;
  return `ORD-${year}${month}-${String(sequence).padStart(4, '0')}`;
}
