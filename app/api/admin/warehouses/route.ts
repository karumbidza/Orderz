import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/warehouses - Get all warehouses
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  // ORDERZ-SEC
  const authError = await requireAdminAuth();
  if (authError) return authError;
  try {
    const warehouses = await sql`
      SELECT 
        id, code, name, is_active
      FROM warehouses
      WHERE is_active = true
      ORDER BY code
    `;

    return NextResponse.json({ success: true, data: warehouses });
  } catch (error) {
    console.error('Error fetching warehouses:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}
