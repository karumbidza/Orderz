import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/excel/lookup-sku - Lookup specific SKU by product, size, role
// Used when user selects size dropdown to auto-fill SKU
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const product = searchParams.get('product');
    const size = searchParams.get('size');
    const role = searchParams.get('role');
    
    if (!product) {
      return Response.json({
        success: false,
        error: 'Product is required',
      }, { status: 400 });
    }
    
    let items;
    
    if (category && size && role) {
      // Exact match with role
      items = await sql`
        SELECT id, sku, category, product, role, size, variant, unit, cost::float as cost
        FROM items
        WHERE is_active = true 
          AND category = ${category}
          AND product = ${product}
          AND size = ${size}
          AND (role = ${role} OR role = 'All' OR role IS NULL)
        ORDER BY 
          CASE WHEN role = ${role} THEN 0 ELSE 1 END
        LIMIT 1
      `;
    } else if (category && size) {
      // Match by category, product, and size
      items = await sql`
        SELECT id, sku, category, product, role, size, variant, unit, cost::float as cost
        FROM items
        WHERE is_active = true 
          AND category = ${category}
          AND product = ${product}
          AND size = ${size}
        LIMIT 1
      `;
    } else if (size) {
      // Match by product and size only
      items = await sql`
        SELECT id, sku, category, product, role, size, variant, unit, cost::float as cost
        FROM items
        WHERE is_active = true 
          AND product = ${product}
          AND size = ${size}
        LIMIT 1
      `;
    } else {
      // Get all items for product (to show available sizes)
      items = await sql`
        SELECT id, sku, category, product, role, size, variant, unit, cost::float as cost
        FROM items
        WHERE is_active = true 
          AND product = ${product}
        ORDER BY 
          CASE size
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
          END
      `;
    }
    
    if (size && items.length > 0) {
      // Single item lookup - return the item
      return Response.json({
        success: true,
        item: items[0],
      });
    } else if (items.length > 0) {
      // Multiple items - return unique sizes
      const sizeMap = new Map<string, any>();
      items.forEach((item: any) => {
        if (item.size && !sizeMap.has(item.size)) {
          sizeMap.set(item.size, item);
        }
      });
      
      return Response.json({
        success: true,
        sizes: Array.from(sizeMap.keys()),
        items: items,
      });
    } else {
      return Response.json({
        success: false,
        error: 'Item not found',
      }, { status: 404 });
    }
    
  } catch (error) {
    console.error('Error looking up SKU:', error);
    return Response.json({
      success: false,
      error: 'Failed to lookup SKU',
    }, { status: 500 });
  }
}
