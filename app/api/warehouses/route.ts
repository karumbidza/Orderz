import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { WarehouseCreateSchema, PaginationSchema } from '@/lib/validations';
import {
  successResponse,
  handleApiError,
  getSearchParams,
  sanitizeSortColumn,
} from '@/lib/api-utils';
import type { Warehouse } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/warehouses - List all warehouses
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    
    const pagination = PaginationSchema.parse({
      page: params.get('page'),
      limit: params.get('limit'),
      sort_by: params.get('sort_by'),
      sort_order: params.get('sort_order'),
    });
    
    const offset = (pagination.page - 1) * pagination.limit;
    const sortCol = sanitizeSortColumn('warehouses', pagination.sort_by || 'code');
    
    const warehouses = await sql`
      SELECT * FROM warehouses 
      WHERE is_active = true
      ORDER BY ${sql(sortCol)} ${sql(pagination.sort_order === 'desc' ? 'DESC' : 'ASC')}
      LIMIT ${pagination.limit} OFFSET ${offset}
    ` as Warehouse[];
    
    const totalResult = await sql`
      SELECT COUNT(*)::int as count FROM warehouses WHERE is_active = true
    ` as { count: number }[];
    
    return successResponse(warehouses, {
      total: totalResult[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/warehouses - Create a new warehouse
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = WarehouseCreateSchema.parse(body);
    
    const result = await sql`
      INSERT INTO warehouses (code, name, location, is_active)
      VALUES (
        ${validated.code},
        ${validated.name},
        ${validated.location || null},
        ${validated.is_active ?? true}
      )
      RETURNING *
    ` as Warehouse[];
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
