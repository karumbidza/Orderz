import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError, generateOrderNumber } from '@/lib/api-utils';

// Schema for Excel order submission
const ExcelOrderSchema = z.object({
  site_code: z.string().min(1),
  warehouse_code: z.string().min(1),
  ordered_by: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(z.object({
    sku: z.string().min(1),
    quantity: z.number().int().positive(),
    notes: z.string().optional(),
  })).min(1),
  submit: z.boolean().default(false), // If true, set status to PENDING
});

// ─────────────────────────────────────────────
// POST /api/excel/submit-order - Submit order from Excel
// Simplified endpoint that uses codes instead of IDs
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ExcelOrderSchema.parse(body);
    
    // Lookup site
    const siteResult = await sql`
      SELECT id FROM sites WHERE code = ${validated.site_code} AND is_active = true
    ` as { id: number }[];
    
    if (siteResult.length === 0) {
      return errorResponse(`Site not found: ${validated.site_code}`, 400);
    }
    const siteId = siteResult[0].id;
    
    // Lookup warehouse
    const warehouseResult = await sql`
      SELECT id FROM warehouses WHERE code = ${validated.warehouse_code} AND is_active = true
    ` as { id: number }[];
    
    if (warehouseResult.length === 0) {
      return errorResponse(`Warehouse not found: ${validated.warehouse_code}`, 400);
    }
    const warehouseId = warehouseResult[0].id;
    
    // Lookup all items by SKU
    const skus = validated.items.map(i => i.sku);
    const itemsResult = await sql`
      SELECT id, sku, cost FROM items 
      WHERE sku = ANY(${skus}) AND is_active = true
    ` as { id: number; sku: string; cost: number }[];
    
    const itemMap = new Map(itemsResult.map(i => [i.sku, i]));
    
    // Validate all SKUs exist
    const missingSKUs = validated.items
      .filter(i => !itemMap.has(i.sku))
      .map(i => i.sku);
    
    if (missingSKUs.length > 0) {
      return errorResponse(`Items not found: ${missingSKUs.join(', ')}`, 400);
    }
    
    // Create order
    const orderNumber = generateOrderNumber();
    const status = validated.submit ? 'PENDING' : 'DRAFT';
    
    const orderResult = await sql`
      INSERT INTO orders (order_number, site_id, warehouse_id, ordered_by, notes, status)
      VALUES (
        ${orderNumber},
        ${siteId},
        ${warehouseId},
        ${validated.ordered_by || null},
        ${validated.notes || null},
        ${status}::order_status
      )
      RETURNING id, order_number, status
    ` as { id: number; order_number: string; status: string }[];
    
    const orderId = orderResult[0].id;
    
    // Add order items
    const addedItems = [];
    const warnings = [];
    
    for (const item of validated.items) {
      const itemData = itemMap.get(item.sku)!;
      
      // Check stock availability
      const stockResult = await sql`
        SELECT quantity FROM stock_levels
        WHERE item_id = ${itemData.id} AND warehouse_id = ${warehouseId}
      ` as { quantity: number }[];
      
      const available = stockResult.length > 0 ? stockResult[0].quantity : 0;
      
      if (available < item.quantity) {
        warnings.push({
          sku: item.sku,
          requested: item.quantity,
          available,
          message: `Insufficient stock: ${available} available, ${item.quantity} requested`,
        });
      }
      
      // Insert order item
      await sql`
        INSERT INTO order_items (order_id, item_id, quantity_ordered, unit_cost, notes)
        VALUES (
          ${orderId},
          ${itemData.id},
          ${item.quantity},
          ${itemData.cost},
          ${item.notes || null}
        )
      `;
      
      addedItems.push({
        sku: item.sku,
        quantity: item.quantity,
        unit_cost: itemData.cost,
        line_total: item.quantity * itemData.cost,
      });
    }
    
    // Calculate order total
    const totalValue = addedItems.reduce((sum, i) => sum + i.line_total, 0);
    
    return successResponse({
      order_id: orderId,
      order_number: orderResult[0].order_number,
      status: orderResult[0].status,
      site_code: validated.site_code,
      warehouse_code: validated.warehouse_code,
      items: addedItems,
      total_items: addedItems.length,
      total_value: totalValue,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
