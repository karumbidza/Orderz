import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { StockMovementCreateSchema, PaginationSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSearchParams,
} from '@/lib/api-utils';
import type { StockMovement } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/stock/movements - Get movement history
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    
    const pagination = PaginationSchema.parse({
      page: params.get('page'),
      limit: params.get('limit'),
    });
    
    const itemId = params.get('item_id');
    const warehouseId = params.get('warehouse_id');
    const movementType = params.get('type');
    
    const offset = (pagination.page - 1) * pagination.limit;
    
    // Build query based on filters
    let movements;
    let totalResult;
    
    const baseQuery = `
      SELECT 
        sm.*,
        i.sku as item_sku,
        i.product as item_product,
        w.code as warehouse_code,
        w.name as warehouse_name
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      JOIN warehouses w ON sm.warehouse_id = w.id
    `;
    
    if (itemId && warehouseId) {
      movements = await sql`
        SELECT 
          sm.*,
          i.sku as item_sku,
          i.product as item_product,
          w.code as warehouse_code,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.item_id = ${parseInt(itemId)}
          AND sm.warehouse_id = ${parseInt(warehouseId)}
        ORDER BY sm.created_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      `;
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM stock_movements
        WHERE item_id = ${parseInt(itemId)} AND warehouse_id = ${parseInt(warehouseId)}
      `;
    } else if (itemId) {
      movements = await sql`
        SELECT 
          sm.*,
          i.sku as item_sku,
          i.product as item_product,
          w.code as warehouse_code,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.item_id = ${parseInt(itemId)}
        ORDER BY sm.created_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      `;
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM stock_movements WHERE item_id = ${parseInt(itemId)}
      `;
    } else if (warehouseId) {
      movements = await sql`
        SELECT 
          sm.*,
          i.sku as item_sku,
          i.product as item_product,
          w.code as warehouse_code,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        WHERE sm.warehouse_id = ${parseInt(warehouseId)}
        ORDER BY sm.created_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      `;
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM stock_movements WHERE warehouse_id = ${parseInt(warehouseId)}
      `;
    } else {
      movements = await sql`
        SELECT 
          sm.*,
          i.sku as item_sku,
          i.product as item_product,
          w.code as warehouse_code,
          w.name as warehouse_name
        FROM stock_movements sm
        JOIN items i ON sm.item_id = i.id
        JOIN warehouses w ON sm.warehouse_id = w.id
        ORDER BY sm.created_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      `;
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM stock_movements
      `;
    }
    
    return successResponse(movements, {
      total: (totalResult as { count: number }[])[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/stock/movements - Record new movement
// This is the ONLY way to modify stock levels
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = StockMovementCreateSchema.parse(body);
    
    // Use the stored procedure for safe stock modification
    const result = await sql`
      SELECT record_stock_movement(
        ${validated.item_id},
        ${validated.warehouse_id},
        ${validated.movement_type}::movement_type,
        ${validated.quantity},
        ${validated.reference_type || null},
        ${validated.reference_id || null},
        ${validated.notes || null},
        ${validated.created_by || null}
      ) as movement_id
    ` as { movement_id: number }[];
    
    // Fetch the created movement with details
    const movement = await sql`
      SELECT 
        sm.*,
        i.sku as item_sku,
        i.product as item_product,
        w.code as warehouse_code
      FROM stock_movements sm
      JOIN items i ON sm.item_id = i.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.id = ${result[0].movement_id}
    `;
    
    return successResponse(movement[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
