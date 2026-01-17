import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const FulfillSchema = z.object({
  fulfilled_by: z.string().max(255).optional(),
  items: z.array(z.object({
    order_item_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).optional(),
});

// ─────────────────────────────────────────────
// POST /api/orders/[id]/fulfill - Fulfill order
// Creates stock movements and updates order items
// ─────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    const body = await request.json();
    const validated = FulfillSchema.parse(body);
    
    // Get order details
    const order = await sql`
      SELECT id, status, warehouse_id FROM orders WHERE id = ${orderId}
    ` as { id: number; status: string; warehouse_id: number }[];
    
    if (order.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    if (!['APPROVED', 'PROCESSING'].includes(order[0].status)) {
      return errorResponse(
        `Cannot fulfill order with status ${order[0].status}. Order must be APPROVED or PROCESSING.`,
        400
      );
    }
    
    // Get order items to fulfill
    let itemsToFulfill;
    
    if (validated.items && validated.items.length > 0) {
      // Fulfill specific items
      itemsToFulfill = validated.items;
    } else {
      // Fulfill all remaining items
      const allItems = await sql`
        SELECT id as order_item_id, (quantity_ordered - quantity_fulfilled) as quantity
        FROM order_items
        WHERE order_id = ${orderId}
          AND quantity_fulfilled < quantity_ordered
      ` as { order_item_id: number; quantity: number }[];
      
      itemsToFulfill = allItems;
    }
    
    if (itemsToFulfill.length === 0) {
      return errorResponse('No items to fulfill', 400);
    }
    
    const fulfilled = [];
    const errors = [];
    
    for (const item of itemsToFulfill) {
      try {
        // Use stored procedure to fulfill
        await sql`
          SELECT fulfill_order_item(
            ${item.order_item_id},
            ${item.quantity},
            ${validated.fulfilled_by || null}
          )
        `;
        
        fulfilled.push({
          order_item_id: item.order_item_id,
          quantity_fulfilled: item.quantity,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        errors.push({
          order_item_id: item.order_item_id,
          error: message,
        });
      }
    }
    
    // Update order status to PROCESSING if not already
    if (order[0].status === 'APPROVED') {
      await sql`
        UPDATE orders SET status = 'PROCESSING' WHERE id = ${orderId}
      `;
    }
    
    // Check if all items are fulfilled
    const remaining = await sql`
      SELECT COUNT(*)::int as count
      FROM order_items
      WHERE order_id = ${orderId}
        AND quantity_fulfilled < quantity_ordered
    ` as { count: number }[];
    
    return successResponse({
      fulfilled,
      errors: errors.length > 0 ? errors : undefined,
      all_fulfilled: remaining[0].count === 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
