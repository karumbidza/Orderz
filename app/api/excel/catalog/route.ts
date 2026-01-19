import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/catalog - Complete item catalog with stock for Excel
// Returns items with stock levels, grouped by product for size selection
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const product = searchParams.get('product');
    const warehouseId = searchParams.get('warehouse_id') || '1'; // Default warehouse
    
    let items;
    
    if (product && category) {
      // Get all variants (sizes) for a specific product
      items = await sql`
        SELECT 
          i.id,
          i.sku,
          i.category,
          i.product,
          COALESCE(i.role, '') as role,
          COALESCE(i.size, '') as size,
          COALESCE(i.variant, '') as variant,
          i.unit,
          i.cost::float as cost,
          COALESCE(sl.quantity, 0)::int as stock_qty,
          CASE 
            WHEN COALESCE(sl.quantity, 0) > 0 THEN true 
            ELSE false 
          END as in_stock
        FROM items i
        LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = ${parseInt(warehouseId)}
        WHERE i.is_active = true 
          AND i.category = ${category}
          AND i.product = ${product}
        ORDER BY 
          CASE i.size
            WHEN 'XS' THEN 1
            WHEN 'S' THEN 2
            WHEN 'M' THEN 3
            WHEN 'L' THEN 4
            WHEN 'XL' THEN 5
            WHEN 'XXL' THEN 6
            WHEN '2XL' THEN 6
            WHEN 'XXXL' THEN 7
            WHEN '3XL' THEN 7
            ELSE 10
          END,
          i.size,
          i.sku
      `;
    } else if (category) {
      // Get all items for a category with stock
      items = await sql`
        SELECT 
          i.id,
          i.sku,
          i.category,
          i.product,
          COALESCE(i.role, '') as role,
          COALESCE(i.size, '') as size,
          COALESCE(i.variant, '') as variant,
          i.unit,
          i.cost::float as cost,
          COALESCE(sl.quantity, 0)::int as stock_qty,
          CASE 
            WHEN COALESCE(sl.quantity, 0) > 0 THEN true 
            ELSE false 
          END as in_stock
        FROM items i
        LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = ${parseInt(warehouseId)}
        WHERE i.is_active = true 
          AND i.category = ${category}
        ORDER BY i.product, 
          CASE i.size
            WHEN 'XS' THEN 1
            WHEN 'S' THEN 2
            WHEN 'M' THEN 3
            WHEN 'L' THEN 4
            WHEN 'XL' THEN 5
            WHEN 'XXL' THEN 6
            WHEN '2XL' THEN 6
            WHEN 'XXXL' THEN 7
            WHEN '3XL' THEN 7
            ELSE 10
          END,
          i.sku
      `;
    } else {
      // Get all items with stock
      items = await sql`
        SELECT 
          i.id,
          i.sku,
          i.category,
          i.product,
          COALESCE(i.role, '') as role,
          COALESCE(i.size, '') as size,
          COALESCE(i.variant, '') as variant,
          i.unit,
          i.cost::float as cost,
          COALESCE(sl.quantity, 0)::int as stock_qty,
          CASE 
            WHEN COALESCE(sl.quantity, 0) > 0 THEN true 
            ELSE false 
          END as in_stock
        FROM items i
        LEFT JOIN stock_levels sl ON sl.item_id = i.id AND sl.warehouse_id = ${parseInt(warehouseId)}
        WHERE i.is_active = true
        ORDER BY i.category, i.product, i.sku
      `;
    }
    
    // Get unique products for dropdown
    const products = await sql`
      SELECT DISTINCT product 
      FROM items 
      WHERE is_active = true 
        ${category ? sql`AND category = ${category}` : sql``}
      ORDER BY product
    `;
    
    // Get unique sizes for the product (if specified)
    let sizes: string[] = [];
    if (product) {
      const sizeSet = new Set<string>();
      items.forEach((item: any) => {
        if (item.size) sizeSet.add(item.size);
      });
      sizes = Array.from(sizeSet);
    }
    
    return Response.json({
      success: true,
      data: items,
      products: products.map((p: any) => p.product),
      sizes: sizes,
      total: items.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching catalog:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch catalog',
    }, { status: 500 });
  }
}
