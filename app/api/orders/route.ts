import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { OrderCreateSchema, PaginationSchema, OrderFilterSchema } from '@/lib/validations';
import {
  successResponse,
  handleApiError,
  getSearchParams,
  generateOrderNumber,
} from '@/lib/api-utils';
import type { Order, OrderWithDetails } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/orders - List orders with filtering
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
    
    const filters = OrderFilterSchema.parse({
      site_id: params.get('site_id'),
      status: params.get('status'),
      from_date: params.get('from_date'),
      to_date: params.get('to_date'),
    });
    
    const offset = (pagination.page - 1) * pagination.limit;
    
    // Use the order summary view
    let orders: OrderWithDetails[];
    let totalResult: { count: number }[];
    
    if (filters.site_id && filters.status) {
      orders = await sql`
        SELECT * FROM v_order_summary
        WHERE site_id = ${filters.site_id}
          AND status = ${filters.status}
        ORDER BY ordered_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as unknown as OrderWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM orders
        WHERE site_id = ${filters.site_id} AND status = ${filters.status}::order_status
      ` as { count: number }[];
    } else if (filters.site_id) {
      orders = await sql`
        SELECT * FROM v_order_summary
        WHERE site_id = ${filters.site_id}
        ORDER BY ordered_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as unknown as OrderWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM orders WHERE site_id = ${filters.site_id}
      ` as { count: number }[];
    } else if (filters.status) {
      orders = await sql`
        SELECT * FROM v_order_summary
        WHERE status = ${filters.status}
        ORDER BY ordered_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as unknown as OrderWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM orders WHERE status = ${filters.status}::order_status
      ` as { count: number }[];
    } else {
      orders = await sql`
        SELECT * FROM v_order_summary
        ORDER BY ordered_at DESC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as unknown as OrderWithDetails[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM orders
      ` as { count: number }[];
    }
    
    return successResponse(orders, {
      total: totalResult[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/orders - Create a new order (DRAFT)
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = OrderCreateSchema.parse(body);
    
    const orderNumber = generateOrderNumber();
    
    const result = await sql`
      INSERT INTO orders (order_number, site_id, warehouse_id, ordered_by, notes, status)
      VALUES (
        ${orderNumber},
        ${validated.site_id},
        ${validated.warehouse_id},
        ${validated.ordered_by || null},
        ${validated.notes || null},
        'DRAFT'
      )
      RETURNING *
    ` as Order[];
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
