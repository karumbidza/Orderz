import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/warehouses - Get all warehouses
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const warehouses = await sql`
      SELECT 
        id, code, name, location, is_active, created_at
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
