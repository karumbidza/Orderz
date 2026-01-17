import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { ItemUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { Item } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────
// GET /api/items/[id] - Get single item
// ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    
    if (isNaN(itemId)) {
      return errorResponse('Invalid item ID', 400);
    }
    
    const result = await sql`
      SELECT * FROM items WHERE id = ${itemId}
    ` as Item[];
    
    if (result.length === 0) {
      return errorResponse('Item not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// PUT /api/items/[id] - Update item
// ─────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    
    if (isNaN(itemId)) {
      return errorResponse('Invalid item ID', 400);
    }
    
    const body = await request.json();
    const validated = ItemUpdateSchema.parse(body);
    
    // Build dynamic update
    const updates: string[] = [];
    const values: Record<string, unknown> = { id: itemId };
    
    if (validated.sku !== undefined) {
      updates.push('sku');
      values.sku = validated.sku;
    }
    if (validated.category !== undefined) {
      updates.push('category');
      values.category = validated.category;
    }
    if (validated.product !== undefined) {
      updates.push('product');
      values.product = validated.product;
    }
    if (validated.role !== undefined) {
      updates.push('role');
      values.role = validated.role;
    }
    if (validated.size !== undefined) {
      updates.push('size');
      values.size = validated.size;
    }
    if (validated.variant !== undefined) {
      updates.push('variant');
      values.variant = validated.variant;
    }
    if (validated.unit !== undefined) {
      updates.push('unit');
      values.unit = validated.unit;
    }
    if (validated.cost !== undefined) {
      updates.push('cost');
      values.cost = validated.cost;
    }
    
    if (updates.length === 0) {
      return errorResponse('No valid fields to update', 400);
    }
    
    // Execute update with all possible fields
    const result = await sql`
      UPDATE items SET
        sku = COALESCE(${validated.sku}, sku),
        category = COALESCE(${validated.category}, category),
        product = COALESCE(${validated.product}, product),
        role = COALESCE(${validated.role}, role),
        size = COALESCE(${validated.size}, size),
        variant = COALESCE(${validated.variant}, variant),
        unit = COALESCE(${validated.unit}, unit),
        cost = COALESCE(${validated.cost}, cost)
      WHERE id = ${itemId}
      RETURNING *
    ` as Item[];
    
    if (result.length === 0) {
      return errorResponse('Item not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/items/[id] - Soft delete item
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    
    if (isNaN(itemId)) {
      return errorResponse('Invalid item ID', 400);
    }
    
    // Soft delete - set is_active to false
    const result = await sql`
      UPDATE items SET is_active = false WHERE id = ${itemId} RETURNING id
    ` as { id: number }[];
    
    if (result.length === 0) {
      return errorResponse('Item not found', 404);
    }
    
    return successResponse({ deleted: true, id: itemId });
  } catch (error) {
    return handleApiError(error);
  }
}
