import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // Never cache

// Validation schema
const CategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().optional(),
  is_active: z.boolean().optional().default(true),
});

// ─────────────────────────────────────────────
// GET /api/categories - Get all categories
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    let categories;
    if (includeInactive) {
      categories = await sql`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.is_active,
          c.created_at,
          c.updated_at,
          COUNT(i.id)::int as item_count
        FROM categories c
        LEFT JOIN items i ON i.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name
      `;
    } else {
      categories = await sql`
        SELECT 
          c.id,
          c.name,
          c.description,
          c.is_active,
          c.created_at,
          c.updated_at,
          COUNT(i.id)::int as item_count
        FROM categories c
        LEFT JOIN items i ON i.category_id = c.id AND i.is_active = true
        WHERE c.is_active = true
        GROUP BY c.id
        ORDER BY c.name
      `;
    }
    
    return Response.json({
      success: true,
      data: categories,
      total: categories.length,
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

// ─────────────────────────────────────────────
// POST /api/categories - Create a new category
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CategorySchema.parse(body);
    
    const result = await sql`
      INSERT INTO categories (name, description, is_active)
      VALUES (${validated.name}, ${validated.description || null}, ${validated.is_active})
      RETURNING *
    `;
    
    return Response.json({
      success: true,
      data: result[0],
      message: `Category "${validated.name}" created successfully`,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    
    // Check for unique constraint violation
    if (error instanceof Error && error.message.includes('unique')) {
      return Response.json(
        { success: false, error: 'Category name already exists' },
        { status: 409 }
      );
    }
    
    console.error('Error creating category:', error);
    return Response.json(
      { success: false, error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
