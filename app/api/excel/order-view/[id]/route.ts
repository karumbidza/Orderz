import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/excel/order-view/[id] - View order as printable HTML
// This can be opened in browser and printed/saved as PDF
// ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return new Response('Invalid order ID', { status: 400 });
    }
    
    // Get order with site details
    const orders = await sql`
      SELECT 
        o.id,
        o.voucher_number,
        o.category,
        o.status,
        o.total_amount,
        o.order_date,
        o.requested_by,
        o.notes,
        o.decline_reason,
        o.dispatched_at,
        o.dispatched_by,
        o.received_at,
        o.received_by,
        s.name as site_name,
        s.site_code,
        s.address,
        s.city,
        s.email,
        s.phone,
        s.contact_name
      FROM orders o
      JOIN sites s ON o.site_id = s.id
      WHERE o.id = ${orderId}
    `;
    
    if (orders.length === 0) {
      return new Response('Order not found', { status: 404 });
    }
    
    const order = orders[0];
    
    // Get order items with dispatch info
    const items = await sql`
      SELECT 
        oi.sku,
        oi.item_name,
        oi.size,
        oi.qty_requested,
        oi.qty_approved,
        oi.qty_dispatched,
        oi.unit_cost,
        oi.line_total
      FROM order_items oi
      WHERE oi.order_id = ${orderId}
      ORDER BY oi.id
    `;
    
    // Generate HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Order ${order.voucher_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 3px solid #006633; padding-bottom: 20px; }
    .header h1 { color: #006633; font-size: 24px; }
    .header h2 { color: #333; font-size: 18px; margin-top: 5px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
    .info-box { background: #f5f5f5; padding: 15px; border-radius: 5px; }
    .info-box h3 { color: #006633; margin-bottom: 10px; font-size: 14px; }
    .info-box p { margin: 5px 0; font-size: 13px; }
    .info-box .label { color: #666; }
    .info-box .value { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #006633; color: white; padding: 10px; text-align: left; font-size: 13px; }
    td { padding: 10px; border-bottom: 1px solid #ddd; font-size: 13px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row { font-weight: bold; background: #e8f5e9 !important; }
    .total-row td { border-top: 2px solid #006633; }
    .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-weight: bold; font-size: 12px; }
    .status-PENDING { background: #fff3cd; color: #856404; }
    .status-PARTIAL_DISPATCH { background: #ffe0b2; color: #e65100; }
    .status-DISPATCHED { background: #cce5ff; color: #004085; }
    .status-RECEIVED { background: #d4edda; color: #155724; }
    .status-DECLINED { background: #f8d7da; color: #721c24; }
    .pending-row { background: #fff3cd !important; }
    .complete-row { background: #e8f5e9 !important; }
    .adjusted-row { background: #e3f2fd !important; }
    .dispatch-summary { margin-top: 20px; padding: 15px; background: #fff8e1; border: 2px solid #ff9800; border-radius: 5px; }
    .dispatch-summary h4 { color: #e65100; margin-bottom: 10px; }
    .decline-notice { margin-top: 20px; padding: 15px; background: #f8d7da; border: 2px solid #dc3545; border-radius: 5px; }
    .decline-notice h4 { color: #721c24; margin-bottom: 10px; }
    .adjustment-notice { margin-top: 20px; padding: 15px; background: #e3f2fd; border: 2px solid #2196f3; border-radius: 5px; }
    .adjustment-notice h4 { color: #1565c0; margin-bottom: 10px; }
    .adjustment-notice ul { margin: 10px 0 0 20px; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 11px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; background: #006633; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <h1>REDAN COUPON</h1>
    <h2>${order.status === 'DECLINED' ? 'DECLINED Order' : order.status === 'PARTIAL_DISPATCH' ? 'Partial Dispatch Note' : order.status === 'DISPATCHED' ? 'Dispatch Note' : 'Request Voucher'} - ${order.voucher_number}</h2>
  </div>
  
  <div class="info-grid">
    <div class="info-box">
      <h3>ORDER INFORMATION</h3>
      <p><span class="label">Voucher:</span> <span class="value">${order.voucher_number}</span></p>
      <p><span class="label">Date:</span> <span class="value">${new Date(order.order_date).toLocaleDateString()}</span></p>
      <p><span class="label">Category:</span> <span class="value">${order.category}</span></p>
      <p><span class="label">Status:</span> <span class="status status-${order.status}">${order.status}</span></p>
      <p><span class="label">Requested By:</span> <span class="value">${order.requested_by || '-'}</span></p>
    </div>
    
    <div class="info-box">
      <h3>SITE DETAILS</h3>
      <p><span class="label">Site:</span> <span class="value">${order.site_name}</span></p>
      <p><span class="label">Code:</span> <span class="value">${order.site_code || '-'}</span></p>
      <p><span class="label">Address:</span> <span class="value">${order.address || '-'}</span></p>
      <p><span class="label">City:</span> <span class="value">${order.city || '-'}</span></p>
      <p><span class="label">Contact:</span> <span class="value">${order.contact_name || '-'}</span></p>
      <p><span class="label">Phone:</span> <span class="value">${order.phone || '-'}</span></p>
    </div>
  </div>
  
  ${order.status === 'DECLINED' ? `
  <div class="decline-notice">
    <h4>❌ ORDER DECLINED</h4>
    <p><strong>Reason:</strong> ${order.decline_reason || 'No reason provided'}</p>
  </div>
  ` : ''}

  ${order.status === 'PARTIAL_DISPATCH' ? `
  <div class="dispatch-summary">
    <h4>⚠️ PARTIAL DISPATCH</h4>
    <p>Some items on this order remain pending and will be dispatched when stock becomes available.</p>
  </div>
  ` : ''}

  ${(() => {
    const adjustedItems = items.filter((item: any) => item.qty_approved !== null && item.qty_approved !== item.qty_requested);
    if (adjustedItems.length === 0) return '';
    return `
  <div class="adjustment-notice">
    <h4>📝 QUANTITY ADJUSTMENTS BY ADMIN</h4>
    <p>The following items had their quantities adjusted:</p>
    <ul>
      ${adjustedItems.map((item: any) => `
        <li><strong>${item.item_name}</strong> (${item.sku}): Requested ${item.qty_requested} → Approved ${item.qty_approved}</li>
      `).join('')}
    </ul>
  </div>
    `;
  })()}

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Item</th>
        <th>SKU</th>
        <th>Size</th>
        <th>Ordered</th>
        <th>Dispatched</th>
        <th>Pending</th>
        <th>Unit Cost</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item: any, index: number) => {
        const dispatched = item.qty_dispatched || 0;
        const pending = item.qty_requested - dispatched;
        const isComplete = pending === 0;
        return `
        <tr class="${isComplete ? 'complete-row' : pending > 0 ? 'pending-row' : ''}">
          <td>${index + 1}</td>
          <td>${item.item_name}</td>
          <td>${item.sku}</td>
          <td>${item.size || '-'}</td>
          <td style="text-align: center;">${item.qty_requested}</td>
          <td style="text-align: center; font-weight: bold; color: ${dispatched > 0 ? '#2e7d32' : '#999'};">${dispatched > 0 ? dispatched : '-'}</td>
          <td style="text-align: center; font-weight: bold; color: ${pending > 0 ? '#e65100' : '#2e7d32'};">${pending > 0 ? pending : '✓'}</td>
          <td>$${parseFloat(item.unit_cost).toFixed(2)}</td>
          <td>$${parseFloat(item.line_total).toFixed(2)}</td>
        </tr>
        `;
      }).join('')}
      <tr class="total-row">
        <td colspan="8" style="text-align: right;">TOTAL:</td>
        <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
      </tr>
    </tbody>
  </table>
  
  ${order.notes ? `<p><strong>Notes:</strong> ${order.notes}</p>` : ''}
  
  ${order.dispatched_at ? `
    <p style="margin-top: 10px;"><strong>Dispatched:</strong> ${new Date(order.dispatched_at).toLocaleString()} by ${order.dispatched_by || '-'}</p>
  ` : ''}
  
  ${order.received_at ? `
    <p><strong>Received:</strong> ${new Date(order.received_at).toLocaleString()} by ${order.received_by || '-'}</p>
  ` : ''}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px dashed #ccc;">
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
      <div>
        <p style="font-weight: bold; margin-bottom: 30px;">Issued By (Warehouse):</p>
        <div style="border-bottom: 1px solid #333; width: 80%; margin-bottom: 5px;">&nbsp;</div>
        <p style="font-size: 11px; color: #666;">Name & Signature</p>
        <p style="margin-top: 15px; font-size: 12px;">Date: _______________</p>
      </div>
      <div>
        <p style="font-weight: bold; margin-bottom: 30px;">Received By (Site):</p>
        <div style="border-bottom: 1px solid #333; width: 80%; margin-bottom: 5px;">&nbsp;</div>
        <p style="font-size: 11px; color: #666;">Name & Signature</p>
        <p style="margin-top: 15px; font-size: 12px;">Date: _______________</p>
      </div>
    </div>
    <p style="text-align: center; font-size: 11px; color: #666; margin-top: 20px;">
      Please verify all items received and sign above. Report any discrepancies immediately.
    </p>
  </div>
  
  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Redan Coupon Order Management System</p>
  </div>
</body>
</html>
    `;
    
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
    
  } catch (error) {
    console.error('Error generating order view:', error);
    return new Response('Error generating order view', { status: 500 });
  }
}
