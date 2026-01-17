import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';
import { successResponse, handleApiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/stock/low - Get low stock alerts
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    // Use the dedicated low stock view
    const lowStock = await sql`
      SELECT * FROM v_low_stock
      ORDER BY shortage DESC
      LIMIT 100
    `;
    
    // Also get summary stats
    const stats = await sql`
      SELECT 
        COUNT(*) as total_low_stock_items,
        COUNT(DISTINCT warehouse_code) as affected_warehouses,
        SUM(shortage) as total_shortage
      FROM v_low_stock
    `;
    
    return successResponse({
      alerts: lowStock,
      summary: stats[0],
    });
  } catch (error) {
    return handleApiError(error);
  }
}
