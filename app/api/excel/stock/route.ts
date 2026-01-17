import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { getSearchParams } from '@/lib/api-utils';

// ─────────────────────────────────────────────
// GET /api/excel/stock - Excel-optimized stock export
// Returns flat, denormalized data for Power Query
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    const warehouseCode = params.get('warehouse');
    const format = params.get('format') || 'json';
    const lowStockOnly = params.get('low_stock') === 'true';
    
    let stock;
    
    if (warehouseCode && lowStockOnly) {
      stock = await sql`
        SELECT 
          item_id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost,
          warehouse_id,
          warehouse_code,
          warehouse_name,
          quantity,
          min_quantity,
          COALESCE(max_quantity, 0) as max_quantity,
          (quantity * cost)::float as stock_value,
          stock_status
        FROM v_stock_summary
        WHERE warehouse_code = ${warehouseCode}
          AND stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
        ORDER BY quantity ASC
      `;
    } else if (warehouseCode) {
      stock = await sql`
        SELECT 
          item_id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost,
          warehouse_id,
          warehouse_code,
          warehouse_name,
          quantity,
          min_quantity,
          COALESCE(max_quantity, 0) as max_quantity,
          (quantity * cost)::float as stock_value,
          stock_status
        FROM v_stock_summary
        WHERE warehouse_code = ${warehouseCode}
        ORDER BY sku
      `;
    } else if (lowStockOnly) {
      stock = await sql`
        SELECT 
          item_id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost,
          warehouse_id,
          warehouse_code,
          warehouse_name,
          quantity,
          min_quantity,
          COALESCE(max_quantity, 0) as max_quantity,
          (quantity * cost)::float as stock_value,
          stock_status
        FROM v_stock_summary
        WHERE stock_status IN ('LOW_STOCK', 'OUT_OF_STOCK')
        ORDER BY quantity ASC
      `;
    } else {
      stock = await sql`
        SELECT 
          item_id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost,
          warehouse_id,
          warehouse_code,
          warehouse_name,
          quantity,
          min_quantity,
          COALESCE(max_quantity, 0) as max_quantity,
          (quantity * cost)::float as stock_value,
          stock_status
        FROM v_stock_summary
        ORDER BY warehouse_code, sku
      `;
    }
    
    if (format === 'csv') {
      const headers = [
        'item_id', 'sku', 'category', 'product', 'role', 'size', 'variant', 
        'unit', 'cost', 'warehouse_id', 'warehouse_code', 'warehouse_name',
        'quantity', 'min_quantity', 'max_quantity', 'stock_value', 'stock_status'
      ];
      const rows = stock.map((row: Record<string, unknown>) => 
        headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="stock.csv"',
        },
      });
    }
    
    return Response.json(stock);
  } catch (error) {
    console.error('Excel stock export error:', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
