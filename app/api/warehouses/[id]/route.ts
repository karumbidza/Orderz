import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { WarehouseUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { Warehouse } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────
// GET /api/warehouses/[id] - Get single warehouse
// ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const warehouseId = parseInt(id);
    
    if (isNaN(warehouseId)) {
      return errorResponse('Invalid warehouse ID', 400);
    }
    
    const result = await sql`
      SELECT * FROM warehouses WHERE id = ${warehouseId}
    ` as Warehouse[];
    
    if (result.length === 0) {
      return errorResponse('Warehouse not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// PUT /api/warehouses/[id] - Update warehouse
// ─────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const warehouseId = parseInt(id);
    
    if (isNaN(warehouseId)) {
      return errorResponse('Invalid warehouse ID', 400);
    }
    
    const body = await request.json();
    const validated = WarehouseUpdateSchema.parse(body);
    
    const result = await sql`
      UPDATE warehouses SET
        code = COALESCE(${validated.code}, code),
        name = COALESCE(${validated.name}, name),
        location = COALESCE(${validated.location}, location),
        is_active = COALESCE(${validated.is_active}, is_active)
      WHERE id = ${warehouseId}
      RETURNING *
    ` as Warehouse[];
    
    if (result.length === 0) {
      return errorResponse('Warehouse not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/warehouses/[id] - Soft delete
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const warehouseId = parseInt(id);
    
    if (isNaN(warehouseId)) {
      return errorResponse('Invalid warehouse ID', 400);
    }
    
    const result = await sql`
      UPDATE warehouses SET is_active = false WHERE id = ${warehouseId} RETURNING id
    ` as { id: number }[];
    
    if (result.length === 0) {
      return errorResponse('Warehouse not found', 404);
    }
    
    return successResponse({ deleted: true, id: warehouseId });
  } catch (error) {
    return handleApiError(error);
  }
}
