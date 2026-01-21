import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/db-schema - Check database schema
// ─────────────────────────────────────────────
export async function GET() {
  try {
    // Get stock_levels table columns
    const stockLevelsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stock_levels'
      ORDER BY ordinal_position
    `;

    // Get stock_movements table columns
    const stockMovementsColumns = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'stock_movements'
      ORDER BY ordinal_position
    `;

    // Try to get a sample from stock_levels
    let stockSample = [];
    try {
      stockSample = await sql`SELECT * FROM stock_levels LIMIT 1`;
    } catch (e) {
      stockSample = [{ error: String(e) }];
    }

    return NextResponse.json({
      success: true,
      stock_levels: {
        columns: stockLevelsColumns,
        sample: stockSample
      },
      stock_movements: {
        columns: stockMovementsColumns
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
