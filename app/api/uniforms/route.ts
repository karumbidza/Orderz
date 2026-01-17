import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/uniforms - Get uniform assignments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = getPaginationParams(searchParams);
    
    const employeeId = searchParams.get('employee_id');
    const siteId = searchParams.get('site_id');
    const status = searchParams.get('status') || 'ACTIVE';
    
    // Build query based on filters
    let assignments;
    
    if (employeeId) {
      assignments = await sql`
        SELECT ua.*, e.employee_code, e.first_name || ' ' || e.last_name as employee_name,
          e.role as employee_role, s.site_code, s.name as site_name,
          i.sku, i.product, i.size
        FROM uniform_assignments ua
        JOIN employees e ON ua.employee_id = e.id
        JOIN items i ON ua.item_id = i.id
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE ua.employee_id = ${parseInt(employeeId)} AND ua.status = ${status}
        ORDER BY e.last_name, e.first_name, ua.assigned_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (siteId) {
      assignments = await sql`
        SELECT ua.*, e.employee_code, e.first_name || ' ' || e.last_name as employee_name,
          e.role as employee_role, s.site_code, s.name as site_name,
          i.sku, i.product, i.size
        FROM uniform_assignments ua
        JOIN employees e ON ua.employee_id = e.id
        JOIN items i ON ua.item_id = i.id
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.site_id = ${parseInt(siteId)} AND ua.status = ${status}
        ORDER BY e.last_name, e.first_name, ua.assigned_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status !== 'all') {
      assignments = await sql`
        SELECT ua.*, e.employee_code, e.first_name || ' ' || e.last_name as employee_name,
          e.role as employee_role, s.site_code, s.name as site_name,
          i.sku, i.product, i.size
        FROM uniform_assignments ua
        JOIN employees e ON ua.employee_id = e.id
        JOIN items i ON ua.item_id = i.id
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE ua.status = ${status}
        ORDER BY e.last_name, e.first_name, ua.assigned_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      assignments = await sql`
        SELECT ua.*, e.employee_code, e.first_name || ' ' || e.last_name as employee_name,
          e.role as employee_role, s.site_code, s.name as site_name,
          i.sku, i.product, i.size
        FROM uniform_assignments ua
        JOIN employees e ON ua.employee_id = e.id
        JOIN items i ON ua.item_id = i.id
        LEFT JOIN sites s ON e.site_id = s.id
        ORDER BY e.last_name, e.first_name, ua.assigned_date DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    return apiResponse(assignments);
  } catch (error) {
    console.error('Error fetching uniform assignments:', error);
    return apiError('Failed to fetch uniform assignments', 500);
  }
}

// POST /api/uniforms - Create uniform assignment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      employee_id, item_id, quantity, 
      assigned_date, order_id, site_stock_movement_id, notes 
    } = body;
    
    if (!employee_id || !item_id) {
      return apiError('employee_id and item_id are required', 400);
    }
    
    const result = await sql`
      INSERT INTO uniform_assignments (
        employee_id, item_id, quantity, assigned_date, 
        order_id, site_stock_movement_id, notes
      ) VALUES (
        ${employee_id}, ${item_id}, ${quantity || 1}, 
        ${assigned_date || new Date().toISOString().split('T')[0]},
        ${order_id || null}, ${site_stock_movement_id || null}, ${notes || null}
      )
      RETURNING *
    `;
    
    return apiResponse(result[0], undefined, 'Uniform assigned');
  } catch (error) {
    console.error('Error assigning uniform:', error);
    return apiError('Failed to assign uniform', 500);
  }
}
