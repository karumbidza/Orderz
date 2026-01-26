import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/site-ledger/[siteId] - Get detailed dispatch ledger for a site
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ siteId: string }> }
) {
  try {
    const { siteId } = await params;
    const siteIdNum = parseInt(siteId);
    
    if (isNaN(siteIdNum)) {
      return NextResponse.json({ success: false, error: 'Invalid site ID' }, { status: 400 });
    }

    // Get date filters from query params
    const searchParams = request.nextUrl.searchParams;
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Build query with optional date filters
    let ledgerItems;
    
    if (dateFrom && dateTo) {
      ledgerItems = await sql`
        SELECT 
          o.id as order_id,
          o.voucher_number,
          o.order_date,
          o.dispatched_at,
          o.status,
          oi.sku,
          oi.item_name,
          oi.size,
          oi.qty_requested,
          oi.qty_dispatched,
          oi.unit_cost,
          (oi.qty_dispatched * oi.unit_cost) as dispatch_value
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.site_id = ${siteIdNum}
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND oi.qty_dispatched > 0
          AND o.dispatched_at >= ${dateFrom}::date
          AND o.dispatched_at < (${dateTo}::date + interval '1 day')
        ORDER BY o.dispatched_at DESC, o.id, oi.id
      `;
    } else if (dateFrom) {
      ledgerItems = await sql`
        SELECT 
          o.id as order_id,
          o.voucher_number,
          o.order_date,
          o.dispatched_at,
          o.status,
          oi.sku,
          oi.item_name,
          oi.size,
          oi.qty_requested,
          oi.qty_dispatched,
          oi.unit_cost,
          (oi.qty_dispatched * oi.unit_cost) as dispatch_value
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.site_id = ${siteIdNum}
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND oi.qty_dispatched > 0
          AND o.dispatched_at >= ${dateFrom}::date
        ORDER BY o.dispatched_at DESC, o.id, oi.id
      `;
    } else if (dateTo) {
      ledgerItems = await sql`
        SELECT 
          o.id as order_id,
          o.voucher_number,
          o.order_date,
          o.dispatched_at,
          o.status,
          oi.sku,
          oi.item_name,
          oi.size,
          oi.qty_requested,
          oi.qty_dispatched,
          oi.unit_cost,
          (oi.qty_dispatched * oi.unit_cost) as dispatch_value
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.site_id = ${siteIdNum}
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND oi.qty_dispatched > 0
          AND o.dispatched_at < (${dateTo}::date + interval '1 day')
        ORDER BY o.dispatched_at DESC, o.id, oi.id
      `;
    } else {
      ledgerItems = await sql`
        SELECT 
          o.id as order_id,
          o.voucher_number,
          o.order_date,
          o.dispatched_at,
          o.status,
          oi.sku,
          oi.item_name,
          oi.size,
          oi.qty_requested,
          oi.qty_dispatched,
          oi.unit_cost,
          (oi.qty_dispatched * oi.unit_cost) as dispatch_value
        FROM orders o
        JOIN order_items oi ON oi.order_id = o.id
        WHERE o.site_id = ${siteIdNum}
          AND o.status IN ('DISPATCHED', 'PARTIAL_DISPATCH', 'RECEIVED')
          AND oi.qty_dispatched > 0
        ORDER BY o.dispatched_at DESC, o.id, oi.id
      `;
    }

    // Calculate totals
    const totalItems = ledgerItems.reduce((sum, item) => sum + (item.qty_dispatched || 0), 0);
    const totalValue = ledgerItems.reduce((sum, item) => sum + parseFloat(item.dispatch_value || 0), 0);

    return NextResponse.json({ 
      success: true, 
      data: {
        items: ledgerItems,
        summary: {
          totalItems,
          totalValue: totalValue.toFixed(2),
          recordCount: ledgerItems.length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching site ledger:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch site ledger: ' + String(error)
    }, { status: 500 });
  }
}
