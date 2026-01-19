import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/catalog - Complete item catalog for Excel
// Returns items grouped by product for size selection
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const product = searchParams.get('product');
    
    let items;
    
    if (product && category) {
      // Get all variants (sizes) for a specific product
      items = await sql`
        SELECT 
          id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost
        FROM items
        WHERE is_active = true 
          AND category = ${category}
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
          END,
          size,
          sku
      `;
    } else if (category) {
      // Get all items for a category
      items = await sql`
        SELECT 
          id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost
        FROM items
        WHERE is_active = true 
          AND category = ${category}
        ORDER BY product, 
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
          END,
          sku
      `;
    } else {
      // Get all items
      items = await sql`
        SELECT 
          id,
          sku,
          category,
          product,
          COALESCE(role, '') as role,
          COALESCE(size, '') as size,
          COALESCE(variant, '') as variant,
          unit,
          cost::float as cost
        FROM items
        WHERE is_active = true
        ORDER BY category, product, sku
      `;
    }
    
    // Get unique products for dropdown
    let products;
    if (category) {
      products = await sql`
        SELECT DISTINCT product 
        FROM items 
        WHERE is_active = true AND category = ${category}
        ORDER BY product
      `;
    } else {
      products = await sql`
        SELECT DISTINCT product 
        FROM items 
        WHERE is_active = true
        ORDER BY product
      `;
    }
    
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
