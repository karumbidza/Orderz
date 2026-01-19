import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/item-sizes - Get available sizes for a product
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const category = searchParams.get('category');
    
    if (!product) {
      return Response.json({
        success: false,
        error: 'Product name is required',
      }, { status: 400 });
    }
    
    // Get all sizes for this product
    let sizes;
    
    if (category) {
      sizes = await sql`
        SELECT 
          id,
          sku,
          product,
          size,
          role,
          unit,
          cost
        FROM items
        WHERE product = ${product}
          AND category = ${category}
          AND is_active = true
          AND size IS NOT NULL
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
          size
      `;
    } else {
      sizes = await sql`
        SELECT 
          id,
          sku,
          product,
          size,
          role,
          unit,
          cost
        FROM items
        WHERE product = ${product}
          AND is_active = true
          AND size IS NOT NULL
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
          size
      `;
    }
    
    // Extract unique sizes
    const sizeSet = new Set<string>();
    sizes.forEach((s: any) => {
      if (s.size) sizeSet.add(s.size);
    });
    const uniqueSizes = Array.from(sizeSet);
    
    return Response.json({
      success: true,
      data: {
        product,
        sizes: uniqueSizes,
        items: sizes,
      },
      total: sizes.length,
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
