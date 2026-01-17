import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/employees - List all employees
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = getPaginationParams(searchParams);
    
    const siteId = searchParams.get('site_id');
    const status = searchParams.get('status') || 'ACTIVE';
    const search = searchParams.get('search');
    
    // Build query based on filters
    let employees;
    
    if (siteId && search && status !== 'all') {
      employees = await sql`
        SELECT e.*, s.site_code, s.name as site_name
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.site_id = ${parseInt(siteId)}
          AND e.status = ${status}
          AND (e.first_name ILIKE ${'%' + search + '%'} OR e.last_name ILIKE ${'%' + search + '%'} OR e.employee_code ILIKE ${'%' + search + '%'})
        ORDER BY e.last_name
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (siteId && status !== 'all') {
      employees = await sql`
        SELECT e.*, s.site_code, s.name as site_name
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.site_id = ${parseInt(siteId)} AND e.status = ${status}
        ORDER BY e.last_name
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (search && status !== 'all') {
      employees = await sql`
        SELECT e.*, s.site_code, s.name as site_name
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.status = ${status}
          AND (e.first_name ILIKE ${'%' + search + '%'} OR e.last_name ILIKE ${'%' + search + '%'} OR e.employee_code ILIKE ${'%' + search + '%'})
        ORDER BY e.last_name
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (status !== 'all') {
      employees = await sql`
        SELECT e.*, s.site_code, s.name as site_name
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        WHERE e.status = ${status}
        ORDER BY e.last_name
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      employees = await sql`
        SELECT e.*, s.site_code, s.name as site_name
        FROM employees e
        LEFT JOIN sites s ON e.site_id = s.id
        ORDER BY e.last_name
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    const countResult = await sql`SELECT COUNT(*) as total FROM employees`;
    
    return apiResponse(employees, { total: parseInt(String(countResult[0].total)) });
  } catch (error) {
    console.error('Error fetching employees:', error);
    return apiError('Failed to fetch employees', 500);
  }
}

// POST /api/employees - Create employee
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { employee_code, first_name, last_name, site_id, role, phone, email, hire_date } = body;
    
    if (!employee_code || !first_name || !last_name) {
      return apiError('employee_code, first_name, and last_name are required', 400);
    }
    
    const result = await sql`
      INSERT INTO employees (employee_code, first_name, last_name, site_id, role, phone, email, hire_date)
      VALUES (${employee_code}, ${first_name}, ${last_name}, ${site_id || null}, ${role || null}, ${phone || null}, ${email || null}, ${hire_date || null})
      RETURNING *
    `;
    
    return apiResponse(result[0], undefined, 'Employee created successfully');
  } catch (error: unknown) {
    console.error('Error creating employee:', error);
    if (error instanceof Error && error.message?.includes('unique')) {
      return apiError('Employee code already exists', 409);
    }
    return apiError('Failed to create employee', 500);
  }
}
