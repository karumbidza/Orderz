import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { PaginationSchema, StockFilterSchema } from '@/lib/validations';
import {
  successResponse,
  handleApiError,
  getSearchParams,
} from '@/lib/api-utils';
import type { StockLevelWithDetails } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/stock - Get stock levels with details
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    
    const pagination = PaginationSchema.parse({
      page: params.get('page'),
      limit: params.get('limit'),
      sort_by: params.get('sort_by'),
      sort_order: params.get('sort_order'),
    });
    
    const filters = StockFilterSchema.parse({
      warehouse_id: params.get('warehouse_id'),
      low_stock: params.get('low_stock'),
      category: params.get('category'),
    });
    
    const offset = (pagination.page - 1) * pagination.limit;
    
    // Use the view for comprehensive stock data
    let stock: StockLevelWithDetails[];
    let totalResult: { count: number }[];
    
    if (filters.warehouse_id && filters.low_stock && filters.category) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
          AND category = ${filters.category}
        ORDER BY quantity ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
          AND category = ${filters.category}
      ` as { count: number }[];
    } else if (filters.warehouse_id && filters.low_stock) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
        ORDER BY quantity ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
      ` as { count: number }[];
    } else if (filters.warehouse_id && filters.category) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND category = ${filters.category}
        ORDER BY sku ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
          AND category = ${filters.category}
      ` as { count: number }[];
    } else if (filters.low_stock && filters.category) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
          AND category = ${filters.category}
        ORDER BY quantity ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
          AND category = ${filters.category}
      ` as { count: number }[];
    } else if (filters.warehouse_id) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
        ORDER BY sku ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE warehouse_id = ${filters.warehouse_id}
      ` as { count: number }[];
    } else if (filters.low_stock) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
        ORDER BY quantity ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
      ` as { count: number }[];
    } else if (filters.category) {
      stock = await sql`
        SELECT * FROM v_stock_summary
        WHERE category = ${filters.category}
        ORDER BY sku ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
        WHERE category = ${filters.category}
      ` as { count: number }[];
    } else {
      stock = await sql`
        SELECT * FROM v_stock_summary
        ORDER BY sku ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as StockLevelWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM v_stock_summary
      ` as { count: number }[];
    }
    
    return successResponse(stock, {
      total: totalResult[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
