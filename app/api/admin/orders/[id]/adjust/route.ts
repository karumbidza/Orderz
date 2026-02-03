import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// PATCH /api/admin/orders/[id]/adjust - Adjust order item quantities
// Admin can reduce/adjust quantities before dispatch
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    const body = await request.json();
    const { adjustments, adjusted_by, adjustment_reason } = body;

    // adjustments = [{ order_item_id, qty_approved, reason? }]
    if (!adjustments || !Array.isArray(adjustments) || adjustments.length === 0) {
      return NextResponse.json({ 
        success: false, 
        error: 'adjustments array is required' 
      }, { status: 400 });
    }

    // Verify order exists and is in a status that can be adjusted
    const orderCheck = await sql`
      SELECT id, status, voucher_number FROM orders WHERE id = ${orderId}
    `;

    if (orderCheck.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const order = orderCheck[0];

    // Only allow adjustments on PENDING or PROCESSING orders
    if (!['PENDING', 'PROCESSING'].includes(order.status)) {
      return NextResponse.json({ 
        success: false, 
        error: `Cannot adjust order in ${order.status} status. Only PENDING or PROCESSING orders can be adjusted.` 
      }, { status: 400 });
    }

    const results: any[] = [];
    let totalAdjustments = 0;
    let newTotalAmount = 0;

    for (const adj of adjustments) {
      const { order_item_id, qty_approved, reason } = adj;

      if (!order_item_id || qty_approved === undefined || qty_approved < 0) {
        results.push({ 
          order_item_id, 
          success: false, 
          error: 'order_item_id and qty_approved >= 0 are required' 
        });
        continue;
      }

      // Get current item details
      const itemResult = await sql`
        SELECT id, qty_requested, qty_approved as current_approved, unit_cost, item_name, sku
        FROM order_items 
        WHERE id = ${order_item_id} AND order_id = ${orderId}
      `;

      if (itemResult.length === 0) {
        results.push({ order_item_id, success: false, error: 'Order item not found' });
        continue;
      }

      const item = itemResult[0];

      // Validate: qty_approved cannot exceed qty_requested
      if (qty_approved > item.qty_requested) {
        results.push({ 
          order_item_id, 
          success: false, 
          error: `Cannot approve more than requested (${item.qty_requested})` 
        });
        continue;
      }

      // Calculate new line total
      const newLineTotal = qty_approved * parseFloat(item.unit_cost);

      // Update the order item
      await sql`
        UPDATE order_items 
        SET 
          qty_approved = ${qty_approved},
          line_total = ${newLineTotal},
          notes = CASE 
            WHEN notes IS NULL OR notes = '' THEN ${reason || `Adjusted by ${adjusted_by || 'Admin'}: ${item.qty_requested} → ${qty_approved}`}
            ELSE notes || ' | ' || ${reason || `Adjusted by ${adjusted_by || 'Admin'}: ${item.qty_requested} → ${qty_approved}`}
          END
        WHERE id = ${order_item_id}
      `;

      results.push({ 
        order_item_id, 
        success: true, 
        sku: item.sku,
        item_name: item.item_name,
        original_qty: item.qty_requested,
        approved_qty: qty_approved,
        new_line_total: newLineTotal
      });

      totalAdjustments++;
    }

    // Recalculate order total based on approved quantities
    const totalsResult = await sql`
      SELECT 
        SUM(COALESCE(qty_approved, qty_requested) * unit_cost) as new_total
      FROM order_items
      WHERE order_id = ${orderId}
    `;

    newTotalAmount = parseFloat(totalsResult[0].new_total) || 0;

    // Update order total and add adjustment note
    await sql`
      UPDATE orders 
      SET 
        total_amount = ${newTotalAmount},
        notes = CASE 
          WHEN notes IS NULL OR notes = '' THEN ${`Quantities adjusted by ${adjusted_by || 'Admin'} on ${new Date().toISOString().split('T')[0]}. Reason: ${adjustment_reason || 'Admin adjustment'}`}
          ELSE notes || ' | ' || ${`Quantities adjusted by ${adjusted_by || 'Admin'} on ${new Date().toISOString().split('T')[0]}. Reason: ${adjustment_reason || 'Admin adjustment'}`}
        END,
        updated_at = NOW()
      WHERE id = ${orderId}
    `;

    return NextResponse.json({
      success: true,
      message: `Adjusted ${totalAdjustments} item(s) on order ${order.voucher_number}`,
      order_id: orderId,
      voucher_number: order.voucher_number,
      new_total_amount: newTotalAmount,
      adjustments: results
    });

  } catch (error) {
    console.error('Error adjusting order:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to adjust order: ' + String(error) 
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// GET /api/admin/orders/[id]/adjust - Get adjustment history for order
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return NextResponse.json({ success: false, error: 'Invalid order ID' }, { status: 400 });
    }

    // Get order items with adjustment info
    const items = await sql`
      SELECT 
        oi.id as order_item_id,
        oi.sku,
        oi.item_name,
        oi.size,
        oi.qty_requested,
        oi.qty_approved,
        oi.qty_dispatched,
        oi.unit_cost,
        oi.line_total,
        oi.notes,
        CASE 
          WHEN oi.qty_approved IS NOT NULL AND oi.qty_approved != oi.qty_requested 
          THEN true 
          ELSE false 
        END as was_adjusted,
        CASE 
          WHEN oi.qty_approved IS NOT NULL 
          THEN oi.qty_requested - oi.qty_approved 
          ELSE 0 
        END as adjustment_amount
      FROM order_items oi
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.item_name, oi.size
    `;

    // Get order summary
    const orderResult = await sql`
      SELECT 
        o.id,
        o.voucher_number,
        o.status,
        o.total_amount,
        o.notes,
        s.name as site_name
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.id = ${orderId}
    `;

    if (orderResult.length === 0) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const adjustedItems = items.filter((item: any) => item.was_adjusted);
    const totalReduction = adjustedItems.reduce((sum: number, item: any) => sum + item.adjustment_amount, 0);

    return NextResponse.json({
      success: true,
      order: orderResult[0],
      items: items,
      summary: {
        total_items: items.length,
        adjusted_items: adjustedItems.length,
        total_quantity_reduced: totalReduction
      }
    });

  } catch (error) {
    console.error('Error fetching adjustment info:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch adjustment info: ' + String(error) 
    }, { status: 500 });
  }
}
