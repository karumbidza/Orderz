import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/site-stock/movements - Get stock movements at sites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = getPaginationParams(searchParams);
    
    const siteId = searchParams.get('site_id');
    const itemId = searchParams.get('item_id');
    const employeeId = searchParams.get('employee_id');
    const movementType = searchParams.get('movement_type');
    
    // Build query based on filters - simplified to common cases
    let movements;
    
    if (siteId) {
      movements = await sql`
        SELECT ssm.*, s.site_code, s.name as site_name,
          i.sku, i.product, i.category,
          e.employee_code, e.first_name || ' ' || e.last_name as employee_name
        FROM site_stock_movements ssm
        JOIN sites s ON ssm.site_id = s.id
        JOIN items i ON ssm.item_id = i.id
        LEFT JOIN employees e ON ssm.employee_id = e.id
        WHERE ssm.site_id = ${parseInt(siteId)}
        ORDER BY ssm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (employeeId) {
      movements = await sql`
        SELECT ssm.*, s.site_code, s.name as site_name,
          i.sku, i.product, i.category,
          e.employee_code, e.first_name || ' ' || e.last_name as employee_name
        FROM site_stock_movements ssm
        JOIN sites s ON ssm.site_id = s.id
        JOIN items i ON ssm.item_id = i.id
        LEFT JOIN employees e ON ssm.employee_id = e.id
        WHERE ssm.employee_id = ${parseInt(employeeId)}
        ORDER BY ssm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (itemId) {
      movements = await sql`
        SELECT ssm.*, s.site_code, s.name as site_name,
          i.sku, i.product, i.category,
          e.employee_code, e.first_name || ' ' || e.last_name as employee_name
        FROM site_stock_movements ssm
        JOIN sites s ON ssm.site_id = s.id
        JOIN items i ON ssm.item_id = i.id
        LEFT JOIN employees e ON ssm.employee_id = e.id
        WHERE ssm.item_id = ${parseInt(itemId)}
        ORDER BY ssm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      movements = await sql`
        SELECT ssm.*, s.site_code, s.name as site_name,
          i.sku, i.product, i.category,
          e.employee_code, e.first_name || ' ' || e.last_name as employee_name
        FROM site_stock_movements ssm
        JOIN sites s ON ssm.site_id = s.id
        JOIN items i ON ssm.item_id = i.id
        LEFT JOIN employees e ON ssm.employee_id = e.id
        ORDER BY ssm.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    return apiResponse(movements);
  } catch (error) {
    console.error('Error fetching site stock movements:', error);
    return apiError('Failed to fetch site stock movements', 500);
  }
}

// POST /api/site-stock/movements - Record a stock movement at a site
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      site_id, item_id, movement_type, quantity, 
      employee_id, serial_numbers, reason, performed_by,
      reference_type, reference_id
    } = body;
    
    if (!site_id || !item_id || !movement_type || quantity === undefined) {
      return apiError('site_id, item_id, movement_type, and quantity are required', 400);
    }
    
    // Use the appropriate function based on movement type
    if (movement_type === 'RECEIVED') {
      const result = await sql`
        SELECT receive_stock_at_site(
          ${site_id}::integer,
          ${item_id}::integer,
          ${quantity}::integer,
          ${reference_id || null}::integer,
          ${employee_id || null}::integer,
          ${serial_numbers || null}::text[],
          ${performed_by || null}::varchar
        ) as movement_id
      `;
      return apiResponse({ movement_id: result[0].movement_id }, undefined, 'Stock received at site');
    } else if (movement_type === 'ISSUED') {
      const result = await sql`
        SELECT issue_stock_at_site(
          ${site_id}::integer,
          ${item_id}::integer,
          ${Math.abs(quantity)}::integer,
          ${employee_id || null}::integer,
          ${serial_numbers || null}::text[],
          ${reason || null}::text,
          ${performed_by || null}::varchar
        ) as movement_id
      `;
      return apiResponse({ movement_id: result[0].movement_id }, undefined, 'Stock issued at site');
    } else {
      // For ADJUSTMENT and RETURN, direct insert
      const result = await sql`
        INSERT INTO site_stock_movements (
          site_id, item_id, movement_type, quantity,
          employee_id, serial_numbers, reason, performed_by,
          reference_type, reference_id
        ) VALUES (
          ${site_id}, ${item_id}, ${movement_type}, ${quantity},
          ${employee_id || null}, ${serial_numbers || null}, ${reason || null}, ${performed_by || null},
          ${reference_type || null}, ${reference_id || null}
        )
        RETURNING *
      `;
      return apiResponse(result[0], undefined, 'Stock movement recorded');
    }
  } catch (error: unknown) {
    console.error('Error recording site stock movement:', error);
    if (error instanceof Error && error.message?.includes('Insufficient stock')) {
      return apiError(error.message, 400);
    }
    return apiError('Failed to record site stock movement', 500);
  }
}
