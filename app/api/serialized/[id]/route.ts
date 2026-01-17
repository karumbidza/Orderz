import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/serialized/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await sql`
      SELECT 
        si.*,
        i.sku,
        i.product,
        s.site_code,
        s.name as site_name,
        w.name as warehouse_name,
        e.employee_code,
        e.first_name || ' ' || e.last_name as employee_name
      FROM serialized_inventory si
      JOIN items i ON si.item_id = i.id
      LEFT JOIN sites s ON si.site_id = s.id
      LEFT JOIN warehouses w ON si.warehouse_id = w.id
      LEFT JOIN employees e ON si.issued_to_employee_id = e.id
      WHERE si.id = ${parseInt(id)}
    `;
    
    if (result.length === 0) {
      return apiError('Serialized item not found', 404);
    }
    
    return apiResponse(result[0]);
  } catch (error) {
    console.error('Error fetching serialized item:', error);
    return apiError('Failed to fetch serialized item', 500);
  }
}

// PUT /api/serialized/[id] - Update serialized item (transfer, issue, etc.)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const itemId = parseInt(id);
    const body = await request.json();
    
    const { 
      action,  // 'transfer_to_site', 'issue_to_employee', 'return', 'void', 'complete'
      site_id,
      employee_id,
      current_number,
      notes,
      status
    } = body;
    
    let updateFields: Record<string, unknown> = { updated_at: 'NOW()' };
    
    switch (action) {
      case 'transfer_to_site':
        if (!site_id) return apiError('site_id required for transfer', 400);
        const result1 = await sql`
          UPDATE serialized_inventory
          SET 
            current_location_type = 'SITE',
            site_id = ${site_id},
            warehouse_id = NULL,
            received_at_site = NOW(),
            status = 'AVAILABLE',
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result1[0], undefined, 'Item transferred to site');
        
      case 'issue_to_employee':
        if (!employee_id) return apiError('employee_id required for issue', 400);
        const result2 = await sql`
          UPDATE serialized_inventory
          SET 
            current_location_type = 'ISSUED',
            issued_to_employee_id = ${employee_id},
            issued_date = NOW(),
            status = 'IN_USE',
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result2[0], undefined, 'Item issued to employee');
        
      case 'return':
        const result3 = await sql`
          UPDATE serialized_inventory
          SET 
            current_location_type = 'SITE',
            issued_to_employee_id = NULL,
            issued_date = NULL,
            status = 'AVAILABLE',
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result3[0], undefined, 'Item returned');
        
      case 'complete':
        const result4 = await sql`
          UPDATE serialized_inventory
          SET 
            status = 'COMPLETED',
            current_number = ${current_number || null},
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result4[0], undefined, 'Item marked as completed');
        
      case 'void':
        const result5 = await sql`
          UPDATE serialized_inventory
          SET 
            current_location_type = 'VOID',
            status = 'VOID',
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result5[0], undefined, 'Item voided');
        
      default:
        // Generic update
        const result6 = await sql`
          UPDATE serialized_inventory
          SET 
            status = COALESCE(${status}, status),
            current_number = COALESCE(${current_number}, current_number),
            notes = COALESCE(${notes}, notes),
            updated_at = NOW()
          WHERE id = ${itemId}
          RETURNING *
        `;
        return apiResponse(result6[0], undefined, 'Item updated');
    }
  } catch (error) {
    console.error('Error updating serialized item:', error);
    return apiError('Failed to update serialized item', 500);
  }
}
