import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Validation schema for order submission from Excel
const OrderItemSchema = z.object({
  item_id: z.number().int().positive(),
  sku: z.string(),
  item_name: z.string(),
  size: z.string().optional().nullable(),
  quantity: z.number().int().positive(),
  unit_cost: z.number().min(0),
  line_total: z.number().min(0),
});

const OrderSubmitSchema = z.object({
  site_id: z.number().int().positive(),
  site_name: z.string(),
  category: z.string().min(1),
  requested_by: z.string().optional(),
  notes: z.string().optional(),
  total_amount: z.number().min(0),
  items: z.array(OrderItemSchema).min(1, 'At least one item is required'),
});

// ─────────────────────────────────────────────
// Helper: Generate voucher number atomically
// ─────────────────────────────────────────────
async function generateVoucherNumber(prefix: string = 'RV'): Promise<string> {
  const year = new Date().getFullYear();
  
  // Atomic increment - handles concurrent users safely
  const result = await sql`
    INSERT INTO voucher_sequences (prefix, year, last_number)
    VALUES (${prefix}, ${year}, 1)
    ON CONFLICT (prefix, year) 
    DO UPDATE SET 
      last_number = voucher_sequences.last_number + 1,
      updated_at = NOW()
    RETURNING last_number
  `;
  
  const sequence = result[0].last_number;
  return `${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

// ─────────────────────────────────────────────
// POST /api/excel/submit-order - Submit order from Excel
// Voucher number is generated server-side (atomic, no conflicts)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = OrderSubmitSchema.parse(body);
    
    // Generate voucher number atomically (handles concurrent users)
    const voucherNumber = await generateVoucherNumber('RV');
    
    // Create the order
    const orderResult = await sql`
      INSERT INTO orders (
        voucher_number,
        site_id,
        category,
        requested_by,
        notes,
        total_amount,
        status,
        order_date,
        created_at
      ) VALUES (
        ${voucherNumber},
        ${validated.site_id},
        ${validated.category},
        ${validated.requested_by || null},
        ${validated.notes || null},
        ${validated.total_amount},
        'PENDING',
        NOW(),
        NOW()
      )
      RETURNING id, voucher_number, status, order_date
    `;
    
    const orderId = orderResult[0].id;
    
    // Insert order items
    for (const item of validated.items) {
      await sql`
        INSERT INTO order_items (
          order_id,
          item_id,
          sku,
          item_name,
          size,
          qty_requested,
          unit_cost,
          line_total
        ) VALUES (
          ${orderId},
          ${item.item_id},
          ${item.sku},
          ${item.item_name},
          ${item.size || null},
          ${item.quantity},
          ${item.unit_cost},
          ${item.line_total}
        )
      `;
    }
    
    return Response.json({
      success: true,
      data: {
        order_id: orderId,
        voucher_number: voucherNumber,
        status: 'PENDING',
        items_count: validated.items.length,
        total_amount: validated.total_amount,
        message: 'Order submitted successfully',
      }
    }, { status: 201 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }
    
    console.error('Error submitting order:', error);
    return Response.json({
      success: false,
      error: 'Failed to submit order',
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET /api/excel/submit-order - Get orders for R.V Summary
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const site_id = searchParams.get('site_id');
    const limit = parseInt(searchParams.get('limit') || '100');
    
    let orders;
    
    if (status && site_id) {
      orders = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.category,
          o.status,
          o.total_amount,
          o.order_date,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.requested_by,
          s.name as site_name,
          s.site_code
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        WHERE o.status = ${status} AND o.site_id = ${parseInt(site_id)}
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    } else if (status) {
      orders = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.category,
          o.status,
          o.total_amount,
          o.order_date,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.requested_by,
          s.name as site_name,
          s.site_code
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        WHERE o.status = ${status}
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    } else {
      orders = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.category,
          o.status,
          o.total_amount,
          o.order_date,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.requested_by,
          s.name as site_name,
          s.site_code
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        ORDER BY o.order_date DESC
        LIMIT ${limit}
      `;
    }
    
    return Response.json({
      success: true,
      data: orders,
      total: orders.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching orders:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch orders',
    }, { status: 500 });
  }
}
