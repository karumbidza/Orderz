import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { SiteUpdateSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';
import { successResponse, errorResponse, handleApiError } from '@/lib/api-utils';
import type { Site } from '@/lib/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ─────────────────────────────────────────────
// GET /api/sites/[id] - Get single site
// ─────────────────────────────────────────────
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const siteId = parseInt(id);
    
    if (isNaN(siteId)) {
      return errorResponse('Invalid site ID', 400);
    }
    
    const result = await sql`
      SELECT * FROM sites WHERE id = ${siteId}
    ` as Site[];
    
    if (result.length === 0) {
      return errorResponse('Site not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// PUT /api/sites/[id] - Update site
// ─────────────────────────────────────────────
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const siteId = parseInt(id);
    
    if (isNaN(siteId)) {
      return errorResponse('Invalid site ID', 400);
    }
    
    const body = await request.json();
    const validated = SiteUpdateSchema.parse(body);
    
    const result = await sql`
      UPDATE sites SET
        name = COALESCE(${validated.name}, name),
        site_code = COALESCE(${validated.site_code}, site_code),
        city = COALESCE(${validated.city}, city),
        address = COALESCE(${validated.address}, address),
        contact_name = COALESCE(${validated.contact_name}, contact_name),
        email = COALESCE(${validated.email}, email),
        phone = COALESCE(${validated.phone}, phone),
        fulfillment_zone = COALESCE(${validated.fulfillment_zone}, fulfillment_zone),
        is_active = COALESCE(${validated.is_active}, is_active)
      WHERE id = ${siteId}
      RETURNING *
    ` as Site[];
    
    if (result.length === 0) {
      return errorResponse('Site not found', 404);
    }
    
    return successResponse(result[0]);
  } catch (error) {
    return handleApiError(error);
  }
}

// ─────────────────────────────────────────────
// DELETE /api/sites/[id] - Soft delete site
// ─────────────────────────────────────────────
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const siteId = parseInt(id);
    
    if (isNaN(siteId)) {
      return errorResponse('Invalid site ID', 400);
    }
    
    const result = await sql`
      UPDATE sites SET is_active = false WHERE id = ${siteId} RETURNING id
    ` as { id: number }[];
    
    if (result.length === 0) {
      return errorResponse('Site not found', 404);
    }
    
    return successResponse({ deleted: true, id: siteId });
  } catch (error) {
    return handleApiError(error);
  }
}
