import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { getSearchParams } from '@/lib/api-utils';

// ─────────────────────────────────────────────
// GET /api/excel/items - Excel-optimized items export
// Returns flat, simple structure for Power Query
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    const category = params.get('category');
    const format = params.get('format') || 'json'; // json or csv
    
    let items;
    
    if (category) {
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
        WHERE is_active = true AND category = ${category}
        ORDER BY sku
      `;
    } else {
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
        ORDER BY category, sku
      `;
    }
    
    if (format === 'csv') {
      const headers = ['id', 'sku', 'category', 'product', 'role', 'size', 'variant', 'unit', 'cost'];
      const rows = items.map((item: Record<string, unknown>) => 
        headers.map(h => `"${String(item[h]).replace(/"/g, '""')}"`).join(',')
      );
      const csv = [headers.join(','), ...rows].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="items.csv"',
        },
      });
    }
    
    return Response.json(items);
  } catch (error) {
    console.error('Excel items export error:', error);
    return Response.json({ error: 'Export failed' }, { status: 500 });
  }
}
