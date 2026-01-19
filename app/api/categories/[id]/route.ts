import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Validation schema for updates
const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  is_active: z.boolean().optional(),
});

// ─────────────────────────────────────────────
// GET /api/categories/[id] - Get single category
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const result = await sql`
      SELECT 
        c.*,
        COUNT(i.id)::int as item_count
      FROM categories c
      LEFT JOIN items i ON i.category_id = c.id
      WHERE c.id = ${id}
      GROUP BY c.id
    `;

    if (result.length === 0) {
      return Response.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      data: result[0],
    });
  } catch (error) {
    console.error('Error fetching category:', error);
    return Response.json(
      { success: false, error: 'Failed to fetch category' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// PUT /api/categories/[id] - Update a category
// ─────────────────────────────────────────────
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validated = UpdateCategorySchema.parse(body);

    // Build dynamic update
    const updates: string[] = [];
    const values: any[] = [];

    if (validated.name !== undefined) {
      updates.push('name');
      values.push(validated.name);
    }
    if (validated.description !== undefined) {
      updates.push('description');
      values.push(validated.description);
    }
    if (validated.is_active !== undefined) {
      updates.push('is_active');
      values.push(validated.is_active);
    }

    if (updates.length === 0) {
      return Response.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Update with dynamic fields
    const result = await sql`
      UPDATE categories 
      SET 
        name = COALESCE(${validated.name}, name),
        description = COALESCE(${validated.description}, description),
        is_active = COALESCE(${validated.is_active}, is_active),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return Response.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    // Also update the category name in items table for consistency
    if (validated.name) {
      await sql`
        UPDATE items SET category = ${validated.name} WHERE category_id = ${id}
      `;
    }

    return Response.json({
      success: true,
      data: result[0],
      message: 'Category updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('unique')) {
      return Response.json(
        { success: false, error: 'Category name already exists' },
        { status: 409 }
      );
    }

    console.error('Error updating category:', error);
    return Response.json(
      { success: false, error: 'Failed to update category' },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────
// DELETE /api/categories/[id] - Delete a category (soft delete)
// ─────────────────────────────────────────────
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return Response.json(
        { success: false, error: 'Invalid category ID' },
        { status: 400 }
      );
    }

    // Check if category has items
    const itemCheck = await sql`
      SELECT COUNT(*)::int as count FROM items WHERE category_id = ${id}
    `;

    if (itemCheck[0].count > 0) {
      // Soft delete - just mark as inactive
      await sql`
        UPDATE categories SET is_active = false, updated_at = NOW() WHERE id = ${id}
      `;
      return Response.json({
        success: true,
        message: `Category deactivated (has ${itemCheck[0].count} items)`,
      });
    }

    // Hard delete if no items
    const result = await sql`
      DELETE FROM categories WHERE id = ${id} RETURNING *
    `;

    if (result.length === 0) {
      return Response.json(
        { success: false, error: 'Category not found' },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: 'Category deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting category:', error);
    return Response.json(
      { success: false, error: 'Failed to delete category' },
      { status: 500 }
    );
  }
}
