import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/item-sizes - Get available sizes for a product + role
// Used for cascading dropdown: Item → Role → Size
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const category = searchParams.get('category');
    const role = searchParams.get('role');
    
    if (!product) {
      return Response.json({
        success: false,
        error: 'Product name is required',
      }, { status: 400 });
    }
    
    let sizes;
    
    // Build query based on parameters
    if (category && role) {
      // Full filter: category + role
      sizes = await sql`
        SELECT id, sku, product, size, role, unit, cost::float as cost
        FROM items
        WHERE product = ${product}
          AND category = ${category}
          AND (role = ${role} OR role = 'All' OR role IS NULL)
          AND is_active = true
          AND size IS NOT NULL
        ORDER BY 
          CASE WHEN role = ${role} THEN 0 ELSE 1 END,
          CASE size
            WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
            WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN '2XL' THEN 6
            WHEN 'XXXL' THEN 7 WHEN '3XL' THEN 7 ELSE 10
          END, size
      `;
    } else if (category) {
      // Category only (for non-uniform or when role not needed)
      sizes = await sql`
        SELECT id, sku, product, size, role, unit, cost::float as cost
        FROM items
        WHERE product = ${product}
          AND category = ${category}
          AND is_active = true
          AND size IS NOT NULL
        ORDER BY 
          CASE size
            WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
            WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN '2XL' THEN 6
            WHEN 'XXXL' THEN 7 WHEN '3XL' THEN 7 ELSE 10
          END, size
      `;
    } else {
      // Product only
      sizes = await sql`
        SELECT id, sku, product, size, role, unit, cost::float as cost
        FROM items
        WHERE product = ${product}
          AND is_active = true
          AND size IS NOT NULL
        ORDER BY 
          CASE size
            WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 WHEN 'L' THEN 4
            WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 WHEN '2XL' THEN 6
            WHEN 'XXXL' THEN 7 WHEN '3XL' THEN 7 ELSE 10
          END, size
      `;
    }
    
    // Extract unique sizes (prefer role-specific if filtering by role)
    const sizeMap = new Map<string, any>();
    sizes.forEach((s: any) => {
      if (s.size) {
        // If role is specified, prefer exact role match
        if (role && s.role === role) {
          sizeMap.set(s.size, s);
        } else if (!sizeMap.has(s.size)) {
          sizeMap.set(s.size, s);
        }
      }
    });
    
    const uniqueSizes = Array.from(sizeMap.keys());
    const items = Array.from(sizeMap.values());
    
    return Response.json({
      success: true,
      sizes: uniqueSizes,
      items: items,
      total: items.length,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching item sizes:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch sizes',
    }, { status: 500 });
  }
}
