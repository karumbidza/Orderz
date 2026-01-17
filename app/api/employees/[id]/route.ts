import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/employees/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    
    const result = await sql`
      SELECT 
        e.*,
        s.site_code,
        s.name as site_name
      FROM employees e
      LEFT JOIN sites s ON e.site_id = s.id
      WHERE e.id = ${employeeId}
    `;
    
    if (result.length === 0) {
      return apiError('Employee not found', 404);
    }
    
    // Get uniform assignments for this employee
    const uniforms = await sql`
      SELECT 
        ua.*,
        i.sku,
        i.product,
        i.size
      FROM uniform_assignments ua
      JOIN items i ON ua.item_id = i.id
      WHERE ua.employee_id = ${employeeId} AND ua.status = 'ACTIVE'
      ORDER BY ua.assigned_date DESC
    `;
    
    return apiResponse({ ...result[0], uniforms });
  } catch (error) {
    console.error('Error fetching employee:', error);
    return apiError('Failed to fetch employee', 500);
  }
}

// PUT /api/employees/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    const body = await request.json();
    
    const { first_name, last_name, site_id, role, phone, email, status } = body;
    
    const result = await sql`
      UPDATE employees
      SET 
        first_name = COALESCE(${first_name}, first_name),
        last_name = COALESCE(${last_name}, last_name),
        site_id = COALESCE(${site_id}, site_id),
        role = COALESCE(${role}, role),
        phone = COALESCE(${phone}, phone),
        email = COALESCE(${email}, email),
        status = COALESCE(${status}, status),
        updated_at = NOW()
      WHERE id = ${employeeId}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return apiError('Employee not found', 404);
    }
    
    return apiResponse(result[0], undefined, 'Employee updated successfully');
  } catch (error) {
    console.error('Error updating employee:', error);
    return apiError('Failed to update employee', 500);
  }
}

// DELETE /api/employees/[id] - Soft delete (set status to TERMINATED)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const employeeId = parseInt(id);
    
    const result = await sql`
      UPDATE employees
      SET status = 'TERMINATED', updated_at = NOW()
      WHERE id = ${employeeId}
      RETURNING *
    `;
    
    if (result.length === 0) {
      return apiError('Employee not found', 404);
    }
    
    return apiResponse(result[0], undefined, 'Employee terminated');
  } catch (error) {
    console.error('Error deleting employee:', error);
    return apiError('Failed to delete employee', 500);
  }
}
