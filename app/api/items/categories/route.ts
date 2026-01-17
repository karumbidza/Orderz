import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/items/categories - Get unique categories
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const categories = await sql`
      SELECT DISTINCT category, COUNT(*)::int as item_count
      FROM items 
      WHERE is_active = true
      GROUP BY category
      ORDER BY category
    `;
    
    return Response.json({
      success: true,
      data: categories,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
