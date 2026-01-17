import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/stock/reconcile - Run stock reconciliation
// Compares stock_levels with calculated from movements
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const discrepancies = await sql`
      SELECT * FROM reconcile_stock_levels()
    `;
    
    return successResponse({
      has_discrepancies: discrepancies.length > 0,
      discrepancy_count: discrepancies.length,
      discrepancies,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
