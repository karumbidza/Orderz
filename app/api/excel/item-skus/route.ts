import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { validateExcelApiKey } from '@/lib/excel-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // ORDERZ-SEC
  const authError = validateExcelApiKey(request);
  if (authError) return authError;
  try {
    const { searchParams } = new URL(request.url);
    const rawProduct = searchParams.get('product');
    const category = searchParams.get('category');

    if (!rawProduct) {
      return NextResponse.json({ success: false, error: 'Product is required' }, { status: 400 });
    }

    // Decode + as space (URL query params encode spaces as + in some clients)
    const product = decodeURIComponent(rawProduct.replace(/\+/g, '%20')).trim();

    // Get all SKUs for this product
    let result;
    if (category) {
      result = await sql`
        SELECT sku, size, role, cost, unit
        FROM items
        WHERE product ILIKE ${product}
        AND category ILIKE ${category}
        AND is_active = true
        ORDER BY role, size
      `;
    } else {
      result = await sql`
        SELECT sku, size, role, cost, unit
        FROM items
        WHERE product ILIKE ${product}
        AND is_active = true
        ORDER BY role, size
      `;
    }

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
