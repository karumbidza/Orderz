import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { ItemCreateSchema, ItemUpdateSchema, PaginationSchema, ItemFilterSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSearchParams,
  sanitizeSortColumn,
} from '@/lib/api-utils';
import type { Item } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/items - List all items with filtering
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    
    // Parse pagination - use || undefined to convert null to undefined for Zod
    const pagination = PaginationSchema.parse({
      page: params.get('page') || undefined,
      limit: params.get('limit') || undefined,
      sort_by: params.get('sort_by') || undefined,
      sort_order: params.get('sort_order') || undefined,
    });
    
    // Parse filters
    const filters = ItemFilterSchema.parse({
      category: params.get('category') || undefined,
      search: params.get('search') || undefined,
    });
    
    const offset = (pagination.page - 1) * pagination.limit;
    
    // Build query with filters
    let items: Item[];
    let totalResult: { count: number }[];
    
    if (filters.category && filters.search) {
      items = await sql`
        SELECT * FROM items 
        WHERE is_active = true 
          AND category = ${filters.category}
          AND (product ILIKE ${'%' + filters.search + '%'} OR sku ILIKE ${'%' + filters.search + '%'})
        ORDER BY id ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Item[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM items 
        WHERE is_active = true 
          AND category = ${filters.category}
          AND (product ILIKE ${'%' + filters.search + '%'} OR sku ILIKE ${'%' + filters.search + '%'})
      ` as { count: number }[];
    } else if (filters.category) {
      items = await sql`
        SELECT * FROM items 
        WHERE is_active = true AND category = ${filters.category}
        ORDER BY product ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Item[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM items 
        WHERE is_active = true AND category = ${filters.category}
      ` as { count: number }[];
    } else if (filters.search) {
      items = await sql`
        SELECT * FROM items 
        WHERE is_active = true 
          AND (product ILIKE ${'%' + filters.search + '%'} OR sku ILIKE ${'%' + filters.search + '%'})
        ORDER BY id ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Item[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM items 
        WHERE is_active = true 
          AND (product ILIKE ${'%' + filters.search + '%'} OR sku ILIKE ${'%' + filters.search + '%'})
      ` as { count: number }[];
    } else {
      items = await sql`
        SELECT * FROM items 
        WHERE is_active = true
        ORDER BY category, product ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Item[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM items WHERE is_active = true
      ` as { count: number }[];
    }
    
    return successResponse(items, {
      total: totalResult[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/items - Create a new item
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = ItemCreateSchema.parse(body);
    
    // Get category name from categories table
    const categoryResult = await sql`
      SELECT name FROM categories WHERE id = ${validated.category_id} AND is_active = true
    `;
    
    if (categoryResult.length === 0) {
      return errorResponse('Invalid category. Please select a valid category.', 400);
    }
    
    const categoryName = categoryResult[0].name;
    
    const result = await sql`
      INSERT INTO items (sku, category, category_id, product, role, size, variant, unit, cost)
      VALUES (
        ${validated.sku},
        ${categoryName},
        ${validated.category_id},
        ${validated.product},
        ${validated.role || null},
        ${validated.size || null},
        ${validated.variant || null},
        ${validated.unit},
        ${validated.cost}
      )
      RETURNING *
    ` as Item[];
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
