import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/serialized - Get serialized inventory (control books, receipt books)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = getPaginationParams(searchParams);
    
    const itemId = searchParams.get('item_id');
    const siteId = searchParams.get('site_id');
    const status = searchParams.get('status');
    const serialNumber = searchParams.get('serial_number');
    
    // Build query based on filters
    let items;
    
    if (siteId) {
      items = await sql`
        SELECT si.*, i.sku, i.product, s.site_code, s.name as site_name,
          w.name as warehouse_name, e.employee_code,
          e.first_name || ' ' || e.last_name as employee_name
        FROM serialized_inventory si
        JOIN items i ON si.item_id = i.id
        LEFT JOIN sites s ON si.site_id = s.id
        LEFT JOIN warehouses w ON si.warehouse_id = w.id
        LEFT JOIN employees e ON si.issued_to_employee_id = e.id
        WHERE si.site_id = ${parseInt(siteId)}
        ORDER BY i.product, si.serial_number
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (serialNumber) {
      items = await sql`
        SELECT si.*, i.sku, i.product, s.site_code, s.name as site_name,
          w.name as warehouse_name, e.employee_code,
          e.first_name || ' ' || e.last_name as employee_name
        FROM serialized_inventory si
        JOIN items i ON si.item_id = i.id
        LEFT JOIN sites s ON si.site_id = s.id
        LEFT JOIN warehouses w ON si.warehouse_id = w.id
        LEFT JOIN employees e ON si.issued_to_employee_id = e.id
        WHERE si.serial_number ILIKE ${'%' + serialNumber + '%'}
        ORDER BY i.product, si.serial_number
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status) {
      items = await sql`
        SELECT si.*, i.sku, i.product, s.site_code, s.name as site_name,
          w.name as warehouse_name, e.employee_code,
          e.first_name || ' ' || e.last_name as employee_name
        FROM serialized_inventory si
        JOIN items i ON si.item_id = i.id
        LEFT JOIN sites s ON si.site_id = s.id
        LEFT JOIN warehouses w ON si.warehouse_id = w.id
        LEFT JOIN employees e ON si.issued_to_employee_id = e.id
        WHERE si.status = ${status}
        ORDER BY i.product, si.serial_number
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      items = await sql`
        SELECT si.*, i.sku, i.product, s.site_code, s.name as site_name,
          w.name as warehouse_name, e.employee_code,
          e.first_name || ' ' || e.last_name as employee_name
        FROM serialized_inventory si
        JOIN items i ON si.item_id = i.id
        LEFT JOIN sites s ON si.site_id = s.id
        LEFT JOIN warehouses w ON si.warehouse_id = w.id
        LEFT JOIN employees e ON si.issued_to_employee_id = e.id
        ORDER BY i.product, si.serial_number
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    return apiResponse(items);
  } catch (error) {
    console.error('Error fetching serialized inventory:', error);
    return apiError('Failed to fetch serialized inventory', 500);
  }
}

// POST /api/serialized - Add a new serialized item (e.g., new receipt book)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      item_id, serial_number, warehouse_id, 
      start_number, end_number, notes 
    } = body;
    
    if (!item_id || !serial_number) {
      return apiError('item_id and serial_number are required', 400);
    }
    
    // Default to HEAD-OFFICE warehouse
    let warehouseId = warehouse_id;
    if (!warehouseId) {
      const warehouse = await sql`SELECT id FROM warehouses WHERE code = 'HEAD-OFFICE' LIMIT 1`;
      warehouseId = warehouse[0]?.id;
    }
    
    const result = await sql`
      INSERT INTO serialized_inventory (
        item_id, serial_number, current_location_type, warehouse_id,
        start_number, end_number, notes, status
      ) VALUES (
        ${item_id}, ${serial_number}, 'WAREHOUSE', ${warehouseId},
        ${start_number || null}, ${end_number || null}, ${notes || null}, 'AVAILABLE'
      )
      RETURNING *
    `;
    
    return apiResponse(result[0], undefined, 'Serialized item added');
  } catch (error: unknown) {
    console.error('Error adding serialized item:', error);
    if (error instanceof Error && error.message?.includes('unique')) {
      return apiError('Serial number already exists for this item', 409);
    }
    return apiError('Failed to add serialized item', 500);
  }
}
