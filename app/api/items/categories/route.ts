import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache

// ─────────────────────────────────────────────
// GET /api/items/categories - Get categories from categories table
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const categories = await sql`
      SELECT 
        c.id,
        c.name as category,
        c.description,
        c.is_active,
        COUNT(i.id)::int as item_count
      FROM categories c
      LEFT JOIN items i ON i.category_id = c.id AND i.is_active = true
      WHERE c.is_active = true
      GROUP BY c.id, c.name, c.description, c.is_active
      ORDER BY c.name
    `;
    
    return Response.json({
      success: true,
      data: categories,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache',
      }
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
