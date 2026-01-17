import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { OrderUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { Order, OrderItemWithDetails } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────
// GET /api/orders/[id] - Get order with items
// ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    // Get order header
    const orderResult = await sql`
      SELECT * FROM v_order_summary WHERE id = ${orderId}
    `;
    
    if (orderResult.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    // Get order items with details
    const items = await sql`
      SELECT 
        oi.*,
        i.sku as item_sku,
        i.product as item_product,
        i.category as item_category,
        COALESCE(sl.quantity, 0) as available_stock
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN stock_levels sl ON oi.item_id = sl.item_id AND o.warehouse_id = sl.warehouse_id
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.id
    ` as OrderItemWithDetails[];
    
    return successResponse({
      order: orderResult[0],
      items,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// PUT /api/orders/[id] - Update order
// ─────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    const body = await request.json();
    const validated = OrderUpdateSchema.parse(body);
    
    // Check current status
    const current = await sql`
      SELECT status FROM orders WHERE id = ${orderId}
    ` as { status: string }[];
    
    if (current.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    // Validate status transitions
    const currentStatus = current[0].status;
    if (validated.status) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ['PENDING', 'CANCELLED'],
        PENDING: ['APPROVED', 'CANCELLED'],
        APPROVED: ['PROCESSING', 'CANCELLED'],
        PROCESSING: ['SHIPPED', 'CANCELLED'],
        SHIPPED: ['DELIVERED'],
        DELIVERED: [],
        CANCELLED: [],
      };
      
      if (!validTransitions[currentStatus]?.includes(validated.status)) {
        return errorResponse(
          `Cannot transition from ${currentStatus} to ${validated.status}`,
          400
        );
      }
    }
    
    // Build update
    let result;
    
    if (validated.status === 'APPROVED') {
      result = await sql`
        UPDATE orders SET
          status = ${validated.status}::order_status,
          approved_by = ${validated.approved_by || null},
          approved_at = CURRENT_TIMESTAMP,
          notes = COALESCE(${validated.notes}, notes)
        WHERE id = ${orderId}
        RETURNING *
      ` as Order[];
    } else if (validated.status === 'SHIPPED') {
      result = await sql`
        UPDATE orders SET
          status = ${validated.status}::order_status,
          shipped_at = CURRENT_TIMESTAMP,
          notes = COALESCE(${validated.notes}, notes)
        WHERE id = ${orderId}
        RETURNING *
      ` as Order[];
    } else if (validated.status === 'DELIVERED') {
      result = await sql`
        UPDATE orders SET
          status = ${validated.status}::order_status,
          delivered_at = CURRENT_TIMESTAMP,
          notes = COALESCE(${validated.notes}, notes)
        WHERE id = ${orderId}
        RETURNING *
      ` as Order[];
    } else {
      result = await sql`
        UPDATE orders SET
          status = COALESCE(${validated.status}::order_status, status),
          notes = COALESCE(${validated.notes}, notes)
        WHERE id = ${orderId}
        RETURNING *
      ` as Order[];
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/orders/[id] - Cancel order
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    // Check if order can be cancelled
    const current = await sql`
      SELECT status FROM orders WHERE id = ${orderId}
    ` as { status: string }[];
    
    if (current.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    const nonCancellable = ['SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (nonCancellable.includes(current[0].status)) {
      return errorResponse(
        `Cannot cancel order with status ${current[0].status}`,
        400
      );
    }
    
    const result = await sql`
      UPDATE orders SET status = 'CANCELLED' WHERE id = ${orderId} RETURNING id
    ` as { id: number }[];
    
    return successResponse({ cancelled: true, id: orderId });
  } catch (error) {
    return handleApiError(error);
  }
}
