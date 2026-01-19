import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const category = searchParams.get('category');

    if (!product) {
      return NextResponse.json({ success: false, error: 'Product is required' }, { status: 400 });
    }

    // Get all SKUs for this product
    const result = await sql`
      SELECT sku, size, role, cost, unit
      FROM items 
      WHERE product = ${product}
      ${category ? sql`AND category = ${category}` : sql``}
      AND is_active = true
      ORDER BY role, size
    `;

    // Extract just the SKU list for dropdown
    const skus = result.map((item: any) => item.sku);

    return NextResponse.json({
      success: true,
      skus: skus,
      items: result
    });

  } catch (error) {
    console.error('Error fetching item SKUs:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch SKUs' }, { status: 500 });
  }
}
