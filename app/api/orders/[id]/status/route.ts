import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Valid status values: PENDING → PROCESSING → DISPATCHED → RECEIVED
const STATUS_VALUES = ['PENDING', 'PROCESSING', 'DISPATCHED', 'RECEIVED', 'CANCELLED'] as const;

const StatusUpdateSchema = z.object({
  status: z.enum(STATUS_VALUES),
  processed_by: z.string().optional(),
  dispatched_by: z.string().optional(),
  received_by: z.string().optional(),
});

// ─────────────────────────────────────────────
// PATCH /api/orders/[id]/status - Update order status
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return Response.json({
        success: false,
        error: 'Invalid order ID',
      }, { status: 400 });
    }
    
    const body = await request.json();
    const validated = StatusUpdateSchema.parse(body);
    
    // Check order exists
    const existingOrder = await sql`
      SELECT id, status FROM orders WHERE id = ${orderId}
    `;
    
    if (existingOrder.length === 0) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }
    
    const currentStatus = existingOrder[0].status;
    
    // Validate status transitions: PENDING → PROCESSING → DISPATCHED → RECEIVED
    if (validated.status === 'PROCESSING') {
      if (currentStatus !== 'PENDING') {
        return Response.json({
          success: false,
          error: `Cannot process order. Current status is ${currentStatus}, must be PENDING`,
        }, { status: 400 });
      }
      
      // Update to PROCESSING
      const result = await sql`
        UPDATE orders 
        SET 
          status = 'PROCESSING',
          processed_at = NOW(),
          processed_by = ${validated.processed_by || null},
          updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING id, voucher_number, status
      `;
      
      return Response.json({
        success: true,
        data: result[0],
        message: 'Order marked as processing',
      });
      
    } else if (validated.status === 'DISPATCHED') {
      if (currentStatus !== 'PENDING' && currentStatus !== 'PROCESSING') {
        return Response.json({
          success: false,
          error: `Cannot dispatch order. Current status is ${currentStatus}, must be PENDING or PROCESSING`,
        }, { status: 400 });
      }
      
      // Update to DISPATCHED
      const result = await sql`
        UPDATE orders 
        SET 
          status = 'DISPATCHED',
          dispatched_at = NOW(),
          dispatched_by = ${validated.dispatched_by || null},
          updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING id, voucher_number, status, dispatched_at, dispatched_by
      `;
      
      return Response.json({
        success: true,
        data: result[0],
        message: 'Order marked as dispatched',
      });
      
    } else if (validated.status === 'RECEIVED') {
      if (currentStatus !== 'DISPATCHED') {
        return Response.json({
          success: false,
          error: `Cannot mark as received. Current status is ${currentStatus}, must be DISPATCHED`,
        }, { status: 400 });
      }
      
      // Update to RECEIVED
      const result = await sql`
        UPDATE orders 
        SET 
          status = 'RECEIVED',
          received_at = NOW(),
          received_by = ${validated.received_by || null},
          updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING id, voucher_number, status, received_at, received_by
      `;
      
      return Response.json({
        success: true,
        data: result[0],
        message: 'Order marked as received',
      });
      
    } else if (validated.status === 'CANCELLED') {
      if (currentStatus === 'RECEIVED') {
        return Response.json({
          success: false,
          error: 'Cannot cancel a received order',
        }, { status: 400 });
      }
      
      // Update to CANCELLED
      const result = await sql`
        UPDATE orders 
        SET 
          status = 'CANCELLED',
          updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING id, voucher_number, status
      `;
      
      return Response.json({
        success: true,
        data: result[0],
        message: 'Order cancelled',
      });
      
    } else if (validated.status === 'PENDING') {
      // Can only revert to PENDING from CANCELLED
      if (currentStatus !== 'CANCELLED') {
        return Response.json({
          success: false,
          error: `Cannot revert to pending. Current status is ${currentStatus}`,
        }, { status: 400 });
      }
      
      const result = await sql`
        UPDATE orders 
        SET 
          status = 'PENDING',
          dispatched_at = NULL,
          dispatched_by = NULL,
          received_at = NULL,
          received_by = NULL,
          updated_at = NOW()
        WHERE id = ${orderId}
        RETURNING id, voucher_number, status
      `;
      
      return Response.json({
        success: true,
        data: result[0],
        message: 'Order reverted to pending',
      });
    }
    
    return Response.json({
      success: false,
      error: 'Invalid status',
    }, { status: 400 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      }, { status: 400 });
    }
    
    console.error('Error updating order status:', error);
    return Response.json({
      success: false,
      error: 'Failed to update order status',
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET /api/orders/[id]/status - Get order details with items
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return Response.json({
        success: false,
        error: 'Invalid order ID',
      }, { status: 400 });
    }
    
    // Get order with site details
    const orders = await sql`
      SELECT 
        o.id,
        o.voucher_number,
        o.category,
        o.status,
        o.total_amount,
        o.order_date,
        o.requested_by,
        o.notes,
        o.dispatched_at,
        o.dispatched_by,
        o.received_at,
        o.received_by,
        o.pdf_path,
        o.emailed_at,
        s.name as site_name,
        s.site_code,
        s.address,
        s.town,
        s.email,
        s.phone
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.id = ${orderId}
    `;
    
    if (orders.length === 0) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }
    
    // Get order items
    const items = await sql`
      SELECT 
        oi.id,
        oi.item_id,
        oi.sku,
        oi.item_name,
        oi.size,
        oi.qty_requested as quantity,
        oi.unit_cost,
        oi.line_total
      FROM order_items oi
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.id
    `;
    
    return Response.json({
      success: true,
      data: {
        ...orders[0],
        items,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching order:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch order',
    }, { status: 500 });
  }
}
