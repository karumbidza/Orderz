import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';

// Validation schema for stock check
const StockCheckSchema = z.object({
  items: z.array(z.object({
    item_id: z.number().int().positive(),
    quantity: z.number().int().positive(),
  })).min(1),
  warehouse_id: z.number().int().positive(),
});

// ─────────────────────────────────────────────
// POST /api/stock/check - Check stock availability
// Use before creating orders to validate stock
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = StockCheckSchema.parse(body);
    
    const results = [];
    let allSufficient = true;
    
    for (const item of validated.items) {
      const stockResult = await sql`
        SELECT 
          sl.item_id,
          i.sku as item_sku,
          sl.warehouse_id,
          sl.quantity as available
        FROM stock_levels sl
        JOIN items i ON sl.item_id = i.id
        WHERE sl.item_id = ${item.item_id}
          AND sl.warehouse_id = ${validated.warehouse_id}
      ` as { item_id: number; item_sku: string; warehouse_id: number; available: number }[];
      
      const available = stockResult.length > 0 ? stockResult[0].available : 0;
      const sufficient = available >= item.quantity;
      
      if (!sufficient) {
        allSufficient = false;
      }
      
      results.push({
        item_id: item.item_id,
        item_sku: stockResult.length > 0 ? stockResult[0].item_sku : null,
        warehouse_id: validated.warehouse_id,
        requested: item.quantity,
        available,
        sufficient,
        shortage: sufficient ? 0 : item.quantity - available,
      });
    }
    
    return successResponse({
      all_sufficient: allSufficient,
      items: results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
