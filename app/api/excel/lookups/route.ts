import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/excel/lookups - Combined lookup data
// Single request for all dropdowns in Excel
// ─────────────────────────────────────────────
export async function GET() {
  try {
    // Fetch all lookup data in parallel
    const [sites, warehouses, categories] = await Promise.all([
      sql`
        SELECT id, code, name 
        FROM sites 
        WHERE is_active = true 
        ORDER BY code
      `,
      sql`
        SELECT id, code, name 
        FROM warehouses 
        WHERE is_active = true 
        ORDER BY code
      `,
      sql`
        SELECT DISTINCT category, COUNT(*)::int as item_count
        FROM items 
        WHERE is_active = true
        GROUP BY category
        ORDER BY category
      `,
    ]);
    
    return Response.json({
      sites,
      warehouses,
      categories,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Lookups error:', error);
    return Response.json({ error: 'Failed to fetch lookups' }, { status: 500 });
  }
}
