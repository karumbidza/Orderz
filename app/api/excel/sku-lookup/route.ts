import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sku = searchParams.get('sku');

    if (!sku) {
      return NextResponse.json({ success: false, error: 'SKU is required' }, { status: 400 });
    }

    const result = await sql`
      SELECT id, sku, product, category, size, role, cost, unit
      FROM items 
      WHERE sku = ${sku}
      AND is_active = true
      LIMIT 1
    `;

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'SKU not found', item_id: 0 });
    }

    return NextResponse.json({
      success: true,
      item_id: result[0].id,
      item: result[0]
    });

  } catch (error) {
    console.error('Error looking up SKU:', error);
    return NextResponse.json({ success: false, error: 'Failed to lookup SKU' }, { status: 500 });
  }
}
