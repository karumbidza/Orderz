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
// Body: { 
//   force_partial?: boolean,  - If true, dispatch available items only
//   items?: { order_item_id: number, qty_to_dispatch: number }[]  - Custom quantities per item
// }
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
    const customItems: { order_item_id: number; qty_to_dispatch: number }[] = body.items || [];
    const hasCustomQty = customItems.length > 0;

    // Get order
    const orderResult = await sql`
      SELECT id, voucher_number, status FROM orders WHERE id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = orderResult[0];

    // Allow dispatching from PENDING, PARTIAL_DISPATCH states
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

    // Build dispatch plan
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
          remaining_after: 0,
          status: 'ALREADY_FULFILLED'
        });
        continue;
      }

      // If custom quantities provided, use those
      let qtyToDispatch: number;
      if (hasCustomQty) {
        const customItem = customItems.find(c => c.order_item_id === item.id);
        qtyToDispatch = customItem ? Math.min(customItem.qty_to_dispatch, remaining, item.stock_available) : 0;
        // Ensure non-negative
        qtyToDispatch = Math.max(0, qtyToDispatch);
      } else {
        qtyToDispatch = Math.min(remaining, item.stock_available);
      }
      
      if (qtyToDispatch > 0) {
        anyDispatchable = true;
      }
      
      const remainingAfter = remaining - qtyToDispatch;
      if (remainingAfter > 0) {
        allFulfilled = false;
      }

      dispatchResults.push({
        ...item,
        qty_to_dispatch: qtyToDispatch,
        remaining_after: remainingAfter,
        status: qtyToDispatch >= remaining ? 'FULL' : qtyToDispatch > 0 ? 'PARTIAL' : 'UNAVAILABLE'
      });
    }

    // If nothing to dispatch
    if (!anyDispatchable) {
      return NextResponse.json({ 
        success: false, 
        error: 'No items to dispatch. Either no stock or all quantities set to 0.',
        items: dispatchResults
      }, { status: 400 });
    }

    // If not all items being fully dispatched and not forcing partial (and no custom qty)
    if (!allFulfilled && !forcePartial && !hasCustomQty) {
      return NextResponse.json({ 
        success: false, 
        error: 'Not all items available. Use force_partial=true or specify custom quantities.',
        items: dispatchResults,
        require_confirmation: true
      }, { status: 400 });
    }

    // Perform dispatch - deduct stock and update qty_dispatched
    const dispatched: any[] = [];
    
    for (const item of dispatchResults) {
      if (item.qty_to_dispatch > 0) {
        const qtyToDispatch = Number(item.qty_to_dispatch);
        const itemId = Number(item.item_id);
        console.log(`Dispatching item_id=${itemId}, order_item_id=${item.id}, qty=${qtyToDispatch}`);
        
        // Update qty_dispatched on order_items
        await sql`
          UPDATE order_items 
          SET qty_dispatched = COALESCE(qty_dispatched, 0) + ${qtyToDispatch}
          WHERE id = ${item.id}
        `;

        // Deduct from stock - use RETURNING to ensure query completes
        const stockUpdate = await sql`
          UPDATE stock_levels 
          SET quantity_on_hand = quantity_on_hand - ${qtyToDispatch},
              last_updated = NOW()
          WHERE item_id = ${itemId} AND warehouse_id = 2
          RETURNING item_id, quantity_on_hand
        `;
        console.log('Stock updated:', stockUpdate);

        // Record stock movement
        await sql`
          INSERT INTO stock_movements (item_id, warehouse_id, quantity, movement_type, reference_type, reference_id, reason, created_at)
          VALUES (
            ${itemId},
            2,
            ${-qtyToDispatch},
            'OUT',
            'ORDER',
            ${String(orderId)},
            ${'Dispatched for order ' + order.voucher_number},
            NOW()
          )
        `;

        dispatched.push({
          order_item_id: item.id,
          sku: item.sku,
          item_name: item.item_name,
          qty_dispatched: item.qty_to_dispatch,
          qty_remaining: item.remaining_after
        });
      }
    }

    // Check if all items are now fully dispatched
    const updatedItems = await sql`
      SELECT 
        qty_requested, 
        COALESCE(qty_dispatched, 0) as qty_dispatched
      FROM order_items
      WHERE order_id = ${orderId}
    `;
    
    const orderFullyDispatched = updatedItems.every(
      (i: any) => i.qty_dispatched >= i.qty_requested
    );

    // Update order status
    const newStatus = orderFullyDispatched ? 'DISPATCHED' : 'PARTIAL_DISPATCH';
    const autoReceiveDate = orderFullyDispatched ? 
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
      message: orderFullyDispatched ? 
        'Order fully dispatched' : 
        'Order partially dispatched - some items pending',
      data: {
        order_id: orderId,
        voucher_number: order.voucher_number,
        new_status: newStatus,
        auto_receive_date: autoReceiveDate,
        items_dispatched: dispatched,
        items_pending: dispatchResults.filter(i => i.remaining_after > 0).map(i => ({
          sku: i.sku,
          item_name: i.item_name,
          qty_remaining: i.remaining_after
        }))
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
