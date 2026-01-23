import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
import { SiteCreateSchema, PaginationSchema } from '@/lib/validations';
import {
  successResponse,
  errorResponse,
  handleApiError,
  getSearchParams,
  sanitizeSortColumn,
} from '@/lib/api-utils';
import type { Site } from '@/lib/types';

// ─────────────────────────────────────────────
// GET /api/sites - List all sites
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const params = getSearchParams(request);
    
    const pagination = PaginationSchema.parse({
      page: params.get('page') || undefined,
      limit: params.get('limit') || undefined,
      sort_by: params.get('sort_by') || undefined,
      sort_order: params.get('sort_order') || undefined,
    });
    
    const search = params.get('search');
    const offset = (pagination.page - 1) * pagination.limit;
    
    let sites: Site[];
    let totalResult: { count: number }[];
    
    if (search) {
      sites = await sql`
        SELECT * FROM sites 
        WHERE is_active = true 
          AND (name ILIKE ${'%' + search + '%'} OR code ILIKE ${'%' + search + '%'})
        ORDER BY name ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Site[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM sites 
        WHERE is_active = true 
          AND (name ILIKE ${'%' + search + '%'} OR code ILIKE ${'%' + search + '%'})
      ` as { count: number }[];
    } else {
      sites = await sql`
        SELECT * FROM sites 
        WHERE is_active = true
        ORDER BY name ASC
        LIMIT ${pagination.limit} OFFSET ${offset}
      ` as Site[];
      
      totalResult = await sql`
        SELECT COUNT(*)::int as count FROM sites WHERE is_active = true
      ` as { count: number }[];
    }
    
    return successResponse(sites, {
      total: totalResult[0].count,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// POST /api/sites - Create a new site
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = SiteCreateSchema.parse(body);
    
    // Auto-generate site_code from name if not provided
    let siteCode = validated.site_code;
    if (!siteCode && validated.name) {
      // Convert "Ardbennie Depot" to "ARDBENNIE-DEPOT"
      siteCode = validated.name
        .toUpperCase()
        .replace(/[^A-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 50);
    }
    
    const result = await sql`
      INSERT INTO sites (code, name, address, contact_person, email, phone, is_active)
      VALUES (
        ${siteCode},
        ${validated.name},
        ${validated.address || null},
        ${validated.contact_name || null},
        ${validated.email || null},
        ${validated.phone || null},
        ${validated.is_active ?? true}
      )
      RETURNING *
    ` as Site[];
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}
