import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/uniforms/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const result = await sql`
      SELECT 
        ua.*,
        e.employee_code,
        e.first_name || ' ' || e.last_name as employee_name,
        s.site_code,
        s.name as site_name,
        i.sku,
        i.product,
        i.size
      FROM uniform_assignments ua
      JOIN employees e ON ua.employee_id = e.id
      JOIN items i ON ua.item_id = i.id
      LEFT JOIN sites s ON e.site_id = s.id
      WHERE ua.id = ${parseInt(id)}
    `;
    
    if (result.length === 0) {
      return apiError('Uniform assignment not found', 404);
    }
    
    return apiResponse(result[0]);
  } catch (error) {
    console.error('Error fetching uniform assignment:', error);
    return apiError('Failed to fetch uniform assignment', 500);
  }
}

// PUT /api/uniforms/[id] - Return or update uniform
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const assignmentId = parseInt(id);
    const body = await request.json();
    
    const { action, condition_on_return, notes, status } = body;
    
    if (action === 'return') {
      const result = await sql`
        UPDATE uniform_assignments
        SET 
          status = 'RETURNED',
          returned_date = CURRENT_DATE,
          condition_on_return = ${condition_on_return || 'GOOD'},
          notes = COALESCE(${notes}, notes),
          updated_at = NOW()
        WHERE id = ${assignmentId}
        RETURNING *
      `;
      return apiResponse(result[0], undefined, 'Uniform returned');
    } else if (action === 'lost') {
      const result = await sql`
        UPDATE uniform_assignments
        SET 
          status = 'LOST',
          notes = COALESCE(${notes}, notes),
          updated_at = NOW()
        WHERE id = ${assignmentId}
        RETURNING *
      `;
      return apiResponse(result[0], undefined, 'Uniform marked as lost');
    } else {
      // Generic update
      const result = await sql`
        UPDATE uniform_assignments
        SET 
          status = COALESCE(${status}, status),
          notes = COALESCE(${notes}, notes),
          updated_at = NOW()
        WHERE id = ${assignmentId}
        RETURNING *
      `;
      return apiResponse(result[0], undefined, 'Uniform assignment updated');
    }
  } catch (error) {
    console.error('Error updating uniform assignment:', error);
    return apiError('Failed to update uniform assignment', 500);
  }
}
