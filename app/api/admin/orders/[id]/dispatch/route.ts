import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/orders/[id]/dispatch - Check stock availability for order
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    // Get order items with stock levels
    const items = await sql`
      SELECT 
        oi.id,
        oi.item_id,
        oi.sku,
        oi.item_name,
        oi.qty_requested,
        COALESCE(oi.qty_dispatched, 0) as qty_dispatched,
        oi.size,
        oi.employee_name,
        oi.unit_cost,
        oi.line_total,
        COALESCE(sl.quantity_on_hand, 0) as stock_available,
        CASE 
          WHEN COALESCE(oi.qty_dispatched, 0) >= oi.qty_requested THEN 'FULFILLED'
          WHEN COALESCE(sl.quantity_on_hand, 0) >= (oi.qty_requested - COALESCE(oi.qty_dispatched, 0)) THEN 'READY'
          WHEN COALESCE(sl.quantity_on_hand, 0) > 0 THEN 'PARTIAL'
          ELSE 'UNAVAILABLE'
        END as dispatch_status
      FROM order_items oi
      LEFT JOIN stock_levels sl ON oi.item_id = sl.item_id
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.item_name
    `;

    // Calculate summary
    const summary = {
      total_items: items.length,
      fulfilled: items.filter((i: any) => i.dispatch_status === 'FULFILLED').length,
      ready: items.filter((i: any) => i.dispatch_status === 'READY').length,
      partial: items.filter((i: any) => i.dispatch_status === 'PARTIAL').length,
      unavailable: items.filter((i: any) => i.dispatch_status === 'UNAVAILABLE').length,
      can_dispatch_full: items.every((i: any) => i.dispatch_status === 'READY' || i.dispatch_status === 'FULFILLED'),
      can_dispatch_partial: items.some((i: any) => i.dispatch_status === 'READY' || i.dispatch_status === 'PARTIAL')
    };

    return NextResponse.json({
      success: true,
      data: {
        order_id: orderId,
        items,
        summary
      }
    });

  } catch (error) {
    console.error('Error checking dispatch status:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to check dispatch status' 
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/orders/[id]/dispatch - Dispatch order (deduct stock)
// Body: { force_partial?: boolean } - If true, dispatch available items only
// ─────────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const orderId = parseInt(params.id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const forcePartial = body.force_partial === true;

    // Get order
    const orderResult = await sql`
      SELECT id, voucher_number, status FROM orders WHERE id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = orderResult[0];

    if (order.status === 'DISPATCHED' || order.status === 'RECEIVED') {
      return NextResponse.json({ 
        success: false, 
        error: `Order already ${order.status.toLowerCase()}` 
      }, { status: 400 });
    }

    // Get items with stock
    const items = await sql`
      SELECT 
        oi.id,
        oi.item_id,
        oi.sku,
        oi.item_name,
        oi.qty_requested,
        COALESCE(oi.qty_dispatched, 0) as qty_dispatched,
        COALESCE(sl.quantity_on_hand, 0) as stock_available
      FROM order_items oi
      LEFT JOIN stock_levels sl ON oi.item_id = sl.item_id
      WHERE oi.order_id = ${orderId}
    `;

    // Check if we can dispatch
    let allFulfilled = true;
    let anyDispatchable = false;
    const dispatchResults: any[] = [];

    for (const item of items) {
      const remaining = item.qty_requested - item.qty_dispatched;
      
      if (remaining <= 0) {
        // Already fulfilled
        dispatchResults.push({
          ...item,
          qty_to_dispatch: 0,
          status: 'ALREADY_FULFILLED'
        });
        continue;
      }

      const canDispatch = Math.min(remaining, item.stock_available);
      
      if (canDispatch > 0) {
        anyDispatchable = true;
      }
      
      if (canDispatch < remaining) {
        allFulfilled = false;
      }

      dispatchResults.push({
        ...item,
        qty_to_dispatch: canDispatch,
        remaining_after: remaining - canDispatch,
        status: canDispatch >= remaining ? 'FULL' : canDispatch > 0 ? 'PARTIAL' : 'UNAVAILABLE'
      });
    }

    // If nothing to dispatch
    if (!anyDispatchable) {
      return NextResponse.json({ 
        success: false, 
        error: 'No items available to dispatch. All items are out of stock.',
        items: dispatchResults
      }, { status: 400 });
    }

    // If not all items available and not forcing partial
    if (!allFulfilled && !forcePartial) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not all items available. Use force_partial=true to dispatch available items.',
        items: dispatchResults,
        require_confirmation: true
      }, { status: 400 });
    }

    // Perform dispatch - deduct stock and update qty_dispatched
    const dispatched: any[] = [];
    
    for (const item of dispatchResults) {
      if (item.qty_to_dispatch > 0) {
        // Update qty_dispatched
        await sql`
          UPDATE order_items 
          SET qty_dispatched = COALESCE(qty_dispatched, 0) + ${item.qty_to_dispatch}
          WHERE id = ${item.id}
        `;

        // Deduct from stock
        await sql`
          UPDATE stock_levels 
          SET quantity_on_hand = quantity_on_hand - ${item.qty_to_dispatch},
              last_updated = NOW()
          WHERE item_id = ${item.item_id}
        `;

        // Record stock movement
        await sql`
          INSERT INTO stock_movements (item_id, warehouse_id, quantity, movement_type, reference_type, reference_id, reason, created_at)
          SELECT 
            ${item.item_id},
            warehouse_id,
            ${-item.qty_to_dispatch},
            'OUT',
            'ORDER',
            ${orderId},
            ${'Dispatched for order ' + order.voucher_number},
            NOW()
          FROM stock_levels WHERE item_id = ${item.item_id}
          LIMIT 1
        `;

        dispatched.push({
          sku: item.sku,
          item_name: item.item_name,
          qty_dispatched: item.qty_to_dispatch
        });
      }
    }

    // Update order status
    const newStatus = allFulfilled ? 'DISPATCHED' : 'PARTIAL_DISPATCH';
    const autoReceiveDate = allFulfilled ? 
      await calculateWorkingDaysAhead(5) : null;

    await sql`
      UPDATE orders 
      SET status = ${newStatus},
          dispatched_at = NOW(),
          dispatched_by = 'Admin',
          auto_receive_date = ${autoReceiveDate}
      WHERE id = ${orderId}
    `;

    return NextResponse.json({
      success: true,
      message: allFulfilled ? 
        'Order fully dispatched' : 
        'Order partially dispatched - some items unavailable',
      data: {
        order_id: orderId,
        voucher_number: order.voucher_number,
        new_status: newStatus,
        auto_receive_date: autoReceiveDate,
        items_dispatched: dispatched,
        items_pending: dispatchResults.filter(i => i.remaining_after > 0)
      }
    });

  } catch (error) {
    console.error('Error dispatching order:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to dispatch order: ' + String(error)
    }, { status: 500 });
  }
}

// Calculate date N working days from now (skip weekends)
async function calculateWorkingDaysAhead(days: number): Promise<string> {
  let date = new Date();
  let count = 0;
  
  while (count < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
  }
  
  return date.toISOString().split('T')[0];
}
