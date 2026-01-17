import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { OrderItem } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const AddItemSchema = z.object({
  item_id: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  notes: z.string().max(500).nullable().optional(),
});

const AddItemsSchema = z.object({
  items: z.array(AddItemSchema).min(1),
});

// ─────────────────────────────────────────────
// GET /api/orders/[id]/items - Get order items
// ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    const items = await sql`
      SELECT 
        oi.*,
        i.sku as item_sku,
        i.product as item_product,
        i.category as item_category,
        i.unit as item_unit,
        COALESCE(sl.quantity, 0) as available_stock
      FROM order_items oi
      JOIN items i ON oi.item_id = i.id
      JOIN orders o ON oi.order_id = o.id
      LEFT JOIN stock_levels sl ON oi.item_id = sl.item_id AND o.warehouse_id = sl.warehouse_id
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.id
    `;
    
    return successResponse(items);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/orders/[id]/items - Add items to order
// ─────────────────────────────────────────────
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    // Check order exists and is in DRAFT status
    const order = await sql`
      SELECT id, status, warehouse_id FROM orders WHERE id = ${orderId}
    ` as { id: number; status: string; warehouse_id: number }[];
    
    if (order.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    if (order[0].status !== 'DRAFT') {
      return errorResponse('Can only add items to DRAFT orders', 400);
    }
    
    const body = await request.json();
    const validated = AddItemsSchema.parse(body);
    
    const addedItems: OrderItem[] = [];
    const errors: string[] = [];
    
    for (const item of validated.items) {
      // Get item cost
      const itemData = await sql`
        SELECT id, cost FROM items WHERE id = ${item.item_id} AND is_active = true
      ` as { id: number; cost: number }[];
      
      if (itemData.length === 0) {
        errors.push(`Item ${item.item_id} not found or inactive`);
        continue;
      }
      
      // Check stock availability (optional warning, not blocking)
      const stockData = await sql`
        SELECT quantity FROM stock_levels 
        WHERE item_id = ${item.item_id} AND warehouse_id = ${order[0].warehouse_id}
      ` as { quantity: number }[];
      
      const available = stockData.length > 0 ? stockData[0].quantity : 0;
      if (available < item.quantity_ordered) {
        errors.push(`Warning: Item ${item.item_id} has only ${available} in stock, requested ${item.quantity_ordered}`);
      }
      
      // Insert or update order item
      const result = await sql`
        INSERT INTO order_items (order_id, item_id, quantity_ordered, unit_cost, notes)
        VALUES (
          ${orderId},
          ${item.item_id},
          ${item.quantity_ordered},
          ${itemData[0].cost},
          ${item.notes || null}
        )
        ON CONFLICT (order_id, item_id)
        DO UPDATE SET 
          quantity_ordered = order_items.quantity_ordered + ${item.quantity_ordered}
        RETURNING *
      ` as OrderItem[];
      
      addedItems.push(result[0]);
    }
    
    return successResponse({
      added: addedItems,
      warnings: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/orders/[id]/items - Clear all items
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return errorResponse('Invalid order ID', 400);
    }
    
    // Check order is in DRAFT status
    const order = await sql`
      SELECT status FROM orders WHERE id = ${orderId}
    ` as { status: string }[];
    
    if (order.length === 0) {
      return errorResponse('Order not found', 404);
    }
    
    if (order[0].status !== 'DRAFT') {
      return errorResponse('Can only modify DRAFT orders', 400);
    }
    
    await sql`
      DELETE FROM order_items WHERE order_id = ${orderId}
    `;
    
    return successResponse({ cleared: true, order_id: orderId });
  } catch (error) {
    return handleApiError(error);
  }
}
