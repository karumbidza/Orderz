import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// POST /api/admin/migrate - Run database migrations
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const migrations: string[] = [];

    // Migration 1: Add qty_dispatched to order_items
    try {
      await sql`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS qty_dispatched INTEGER DEFAULT 0`;
      migrations.push('Added qty_dispatched to order_items');
    } catch (e) {
      migrations.push('qty_dispatched already exists or error: ' + String(e));
    }

    // Migration 2: Add dispatched_at to orders if not exists
    try {
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMP`;
      migrations.push('Added dispatched_at to orders');
    } catch (e) {
      migrations.push('dispatched_at: ' + String(e));
    }

    // Migration 3: Add auto_receive_date to orders
    try {
      await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS auto_receive_date DATE`;
      migrations.push('Added auto_receive_date to orders');
    } catch (e) {
      migrations.push('auto_receive_date: ' + String(e));
    }

    // Migration 4: Ensure status can handle new values
    // Check current status values
    const statusCheck = await sql`
      SELECT DISTINCT status FROM orders LIMIT 10
    `;

    return NextResponse.json({
      success: true,
      message: 'Migrations completed',
      migrations,
      current_statuses: statusCheck.map((s: Record<string, any>) => s.status)
    });

  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Migration failed: ' + String(error) 
    }, { status: 500 });
  }
}

// GET - Check migration status
export async function GET(request: NextRequest) {
  try {
    const orderItemsCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'order_items'
    `;

    const ordersCols = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'orders'
    `;

    const hasQtyDispatched = orderItemsCols.some((c: Record<string, any>) => c.column_name === 'qty_dispatched');
    const hasAutoReceiveDate = ordersCols.some((c: Record<string, any>) => c.column_name === 'auto_receive_date');

    return NextResponse.json({
      success: true,
      order_items_columns: orderItemsCols.map((c: Record<string, any>) => c.column_name),
      orders_columns: ordersCols.map((c: Record<string, any>) => c.column_name),
      migration_status: {
        qty_dispatched: hasQtyDispatched ? '✅ exists' : '❌ missing',
        auto_receive_date: hasAutoReceiveDate ? '✅ exists' : '❌ missing'
      }
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: String(error) 
    }, { status: 500 });
  }
}
