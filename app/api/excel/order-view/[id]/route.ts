// ORDERZ-ORDERVIEW
// ORDERZ-DISPATCH
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// NO AUTH — public URL, order ID is the access token

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const sql = neon(process.env.DATABASE_URL!);
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return new NextResponse('Order not found', { status: 404 });
    }

    const [orders, items] = await Promise.all([
      sql`
        SELECT
          o.id,
          o.voucher_number,
          o.category,
          o.status AS order_status,
          o.total_amount,
          o.order_date,
          o.requested_by,
          o.notes,
          o.dispatched_at,
          o.dispatched_by,
          o.received_at,
          o.received_by,
          o.decline_reason,
          o.updated_at,
          s.name AS site_name,
          s.site_code,
          s.city,
          s.address,
          s.phone,
          s.email,
          s.contact_name
        FROM orders o
        LEFT JOIN sites s ON o.site_id = s.id
        WHERE o.id = ${orderId}
        LIMIT 1
      `,
      sql`
        SELECT
          oi.id,
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
        ORDER BY oi.item_name
      `,
    ]);

    if (orders.length === 0) {
      return new NextResponse('Order not found', { status: 404 });
    }

    const order = { ...(orders[0] as Record<string, unknown>), status: (orders[0] as Record<string, unknown>).order_status as string } as Record<string, unknown>;
    const orderItems = items as Record<string, unknown>[];

    const formatDate = (d: unknown): string => {
      if (!d) return '—';
      try {
        return new Date(d as string).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      } catch {
        return String(d);
      }
    };

    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      PENDING: { label: 'Pending', color: '#92400e', bg: '#fef3c7' },
      PROCESSING: { label: 'Processing', color: '#1e40af', bg: '#dbeafe' },
      DISPATCHED: { label: 'Dispatched', color: '#1e40af', bg: '#dbeafe' },
      PARTIAL_DISPATCH: { label: 'Partially Dispatched', color: '#5b21b6', bg: '#ede9fe' },
      RECEIVED: { label: 'Received', color: '#065f46', bg: '#d1fae5' },
      DECLINED: { label: 'Declined', color: '#9f1239', bg: '#ffe4e6' },
    };

    const orderStatus = order.status as string;
    const status =
      statusMap[orderStatus] ?? {
        label: orderStatus,
        color: '#374151',
        bg: '#f3f4f6',
      };
    const canMarkReceived =
      orderStatus === 'DISPATCHED' || orderStatus === 'PARTIAL_DISPATCH';

    // ORDERZ-DISPATCH — dispatch columns: Ordered / Dispatched / Pending
    const itemRows = orderItems.map((item) => {
      const ordered    = Number(item.qty_requested) || 0;
      const dispatched = Number(item.qty_dispatched) || 0;
      const pending    = Math.max(0, ordered - dispatched);
      const isPartial  = dispatched > 0 && pending > 0;
      const isNotSent  = dispatched === 0;

      const dispatchedCell = dispatched > 0
        ? `<td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:center;color:#065f46;font-weight:500">&#10003; ${dispatched}</td>`
        : `<td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:center;color:rgba(0,0,0,0.25)">&mdash;</td>`;

      const pendingCell = pending > 0
        ? `<td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:center;color:#92400e;font-weight:500">${pending}</td>`
        : `<td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:center;color:rgba(0,0,0,0.25)">&mdash;</td>`;

      const rowBg = isNotSent
        ? 'background:rgba(0,0,0,0.015)'
        : isPartial
          ? 'background:#fffbeb'
          : '';

      return `
      <tr style="${rowBg}">
        <td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;font-weight:500">${item.item_name ?? '&mdash;'}${item.size ? ` <span style="color:rgba(0,0,0,0.4);font-size:11px">${item.size}</span>` : ''}</td>
        <td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:12px;color:rgba(0,0,0,0.45);font-family:monospace">${item.sku ?? '&mdash;'}</td>
        <td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:center">${ordered}</td>
        ${dispatchedCell}
        ${pendingCell}
        <td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:right">$${Number(item.unit_cost ?? 0).toFixed(2)}</td>
        <td style="padding:10px 14px;border-bottom:0.5px solid rgba(0,0,0,0.06);font-size:13px;text-align:right;font-weight:500">$${Number(item.line_total ?? 0).toFixed(2)}</td>
      </tr>`;
    }).join('');

    // ORDERZ-DISPATCH — status banner
    const statusBanner = (): string => {
      if (orderStatus === 'RECEIVED') {
        return `<div style="background:#d1fae5;color:#065f46;border:0.5px solid #a7f3d0;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px">&#10003; Received at site</div>`;
      }
      if (orderStatus === 'DISPATCHED') {
        return `<div style="background:#d1fae5;color:#065f46;border:0.5px solid #a7f3d0;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px">&#10003; All items dispatched</div>`;
      }
      if (orderStatus === 'PARTIAL_DISPATCH') {
        return `<div style="background:#fef3c7;color:#92400e;border:0.5px solid #fde68a;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:600;display:flex;align-items:center;gap:8px">&#9888; PARTIAL DISPATCH &mdash; This delivery contains only some items from the order. Remaining items will be dispatched when stock is available.</div>`;
      }
      if (orderStatus === 'PENDING' || orderStatus === 'PROCESSING') {
        return `<div style="background:#dbeafe;color:#1e40af;border:0.5px solid #bfdbfe;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:500;display:flex;align-items:center;gap:8px">&#8505; Order is being processed</div>`;
      }
      if (orderStatus === 'DECLINED') {
        return `<div style="background:#ffe4e6;color:#9f1239;border:0.5px solid #fecdd3;border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:13px;font-weight:500">&#10005; This order was declined</div>`;
      }
      return '';
    };

    // ORDERZ-DISPATCH — dispatch summary section
    const showSummary = orderStatus === 'DISPATCHED' || orderStatus === 'PARTIAL_DISPATCH' || orderStatus === 'RECEIVED';
    const dispatchedItems = orderItems.filter(i => Number(i.qty_dispatched) > 0);
    const pendingItems = orderItems.filter(i => (Number(i.qty_requested) - Number(i.qty_dispatched)) > 0);

    const dispatchSummary = showSummary ? `
  <div style="background:#fff;border:0.5px solid rgba(0,0,0,0.08);border-radius:14px;overflow:hidden;margin-bottom:12px">
    <div style="padding:14px 20px;border-bottom:0.5px solid rgba(0,0,0,0.06)">
      <span style="font-size:11px;font-weight:600;color:rgba(0,0,0,0.35);letter-spacing:.06em;text-transform:uppercase">Dispatch Summary</span>
    </div>
    <div style="display:grid;grid-template-columns:${pendingItems.length > 0 ? '1fr 1fr' : '1fr'};gap:0;padding:0">
      <div style="padding:16px 20px;${pendingItems.length > 0 ? 'border-right:0.5px solid rgba(0,0,0,0.06)' : ''}">
        <div style="font-size:12px;font-weight:600;color:#065f46;margin-bottom:10px">&#10003; Items Dispatched (This Delivery)</div>
        ${dispatchedItems.map(i => `<div style="font-size:12px;color:rgba(0,0,0,0.65);padding:3px 0"><span style="color:#065f46;font-size:11px">&#8226;</span> ${String(i.item_name)} (${String(i.sku)}): <strong>${String(i.qty_dispatched)} of ${String(i.qty_requested)}</strong></div>`).join('')}
      </div>
      ${pendingItems.length > 0 ? `
      <div style="padding:16px 20px">
        <div style="font-size:12px;font-weight:600;color:#92400e;margin-bottom:10px">&#9888; Items Pending (To Follow)</div>
        ${pendingItems.map(i => {
          const pend = Number(i.qty_requested) - Number(i.qty_dispatched);
          return `<div style="font-size:12px;color:rgba(0,0,0,0.65);padding:3px 0"><span style="color:#92400e;font-size:11px">&#8226;</span> ${String(i.item_name)} (${String(i.sku)}): <strong>${pend} pending</strong></div>`;
        }).join('')}
        <div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:10px;font-style:italic">Pending items will be dispatched when stock becomes available.</div>
      </div>` : ''}
    </div>
  </div>` : '';

    const cityAddress = [order.city, order.address].filter(Boolean).join(' &middot; ');
    const phoneEmail = [order.phone, order.email].filter(Boolean).join(' &middot; ');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order ${order.voucher_number ?? '#' + String(order.id)} &mdash; Redan</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', system-ui, sans-serif; background: #f8f8f6; color: #0a0a0a; min-height: 100vh; padding: 40px 20px; }
    .container { max-width: 760px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
    .brand { font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
    .brand span { font-weight: 300; color: rgba(0,0,0,0.4); font-size: 13px; display: block; margin-top: 2px; }
    .card { background: #fff; border: 0.5px solid rgba(0,0,0,0.08); border-radius: 16px; overflow: hidden; margin-bottom: 12px; }
    .card-header { padding: 18px 22px; border-bottom: 0.5px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center; }
    .card-title { font-size: 11px; font-weight: 600; color: rgba(0,0,0,0.35); letter-spacing: 0.07em; text-transform: uppercase; }
    .card-body { padding: 18px 22px; }
    .order-number { font-size: 28px; font-weight: 500; letter-spacing: -1px; margin-bottom: 4px; }
    .order-date { font-size: 13px; color: rgba(0,0,0,0.4); }
    .status-badge { display: inline-flex; align-items: center; padding: 6px 14px; border-radius: 100px; font-size: 12px; font-weight: 600; background: ${status.bg}; color: ${status.color}; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-label { font-size: 10px; font-weight: 600; color: rgba(0,0,0,0.35); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 4px; }
    .info-value { font-size: 14px; color: #0a0a0a; font-weight: 500; }
    .info-sub { font-size: 12px; color: rgba(0,0,0,0.4); margin-top: 1px; }
    table { width: 100%; border-collapse: collapse; }
    th { padding: 10px 14px; background: rgba(0,0,0,0.02); border-bottom: 0.5px solid rgba(0,0,0,0.08); font-size: 10px; font-weight: 600; color: rgba(0,0,0,0.35); letter-spacing: 0.07em; text-transform: uppercase; text-align: left; }
    .total-row { display: flex; justify-content: flex-end; align-items: center; gap: 32px; padding: 16px 22px; border-top: 0.5px solid rgba(0,0,0,0.08); }
    .total-label { font-size: 12px; color: rgba(0,0,0,0.4); }
    .total-amount { font-size: 22px; font-weight: 600; letter-spacing: -0.5px; }
    .action-bar { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }
    .btn-secondary { background: #fff; color: #0a0a0a; border: 0.5px solid rgba(0,0,0,0.15); border-radius: 10px; padding: 12px 24px; font-size: 14px; cursor: pointer; font-family: inherit; }
    .btn-success { background: #065f46; color: #fff; border: none; border-radius: 10px; padding: 12px 24px; font-size: 14px; font-weight: 500; cursor: pointer; font-family: inherit; }
    .received-msg { background: #d1fae5; color: #065f46; border-radius: 10px; padding: 12px 20px; font-size: 13px; font-weight: 500; display: inline-flex; align-items: center; gap: 8px; }
    .history-item { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 0.5px solid rgba(0,0,0,0.05); font-size: 13px; }
    .history-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .history-date { font-size: 11px; color: rgba(0,0,0,0.35); margin-left: auto; }
    @media print {
      body { background: #fff; padding: 0; }
      .no-print { display: none !important; }
      .action-bar { display: none; }
    }
    @media (max-width: 600px) {
      .info-grid { grid-template-columns: 1fr; }
      .header { flex-direction: column; gap: 12px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">Redan<span>Stock Request Voucher</span></div>
      <div style="text-align:right">
        <div style="font-size:12px;color:rgba(0,0,0,0.35);margin-bottom:4px">Generated</div>
        <div style="font-size:13px;font-weight:500">${formatDate(new Date().toISOString())}</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Order Details</span>
        <span class="status-badge" id="statusBadge">${status.label}</span>
      </div>
      <div class="card-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
          <div>
            <div class="order-number">${order.voucher_number ?? '#' + String(order.id)}</div>
            <div class="order-date">${formatDate(order.order_date)} &middot; ${order.category ?? ''}</div>
          </div>
          ${order.requested_by ? `<div style="text-align:right"><div class="info-label">Requested by</div><div class="info-value">${order.requested_by}</div></div>` : ''}
        </div>
        <div class="info-grid">
          <div>
            <div class="info-label">Site</div>
            <div class="info-value">${order.site_name ?? '&mdash;'}</div>
            ${cityAddress ? `<div class="info-sub">${cityAddress}</div>` : ''}
          </div>
          <div>
            <div class="info-label">Contact</div>
            <div class="info-value">${order.contact_name ?? '&mdash;'}</div>
            ${phoneEmail ? `<div class="info-sub">${phoneEmail}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    ${statusBanner()}

    <div class="card">
      <div class="card-header">
        <span class="card-title">Order Items (${orderItems.length} line ${orderItems.length === 1 ? 'item' : 'items'})</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Item</th>
            <th>SKU</th>
            <th style="text-align:center">Ordered</th>
            <th style="text-align:center">Dispatched</th>
            <th style="text-align:center">Pending</th>
            <th style="text-align:right">Unit $</th>
            <th style="text-align:right">Total $</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || '<tr><td colspan="7" style="padding:24px;text-align:center;color:rgba(0,0,0,0.35)">No items found</td></tr>'}
        </tbody>
      </table>
      <div class="total-row">
        <span class="total-label">Order Total</span>
        <span class="total-amount">${Number(order.total_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
    </div>

    ${dispatchSummary}

    <div class="card">
      <div class="card-header"><span class="card-title">Status History</span></div>
      <div class="card-body">
        <div class="history-item">
          <div class="history-dot" style="background:#065f46"></div>
          <span>Order submitted</span>
          <span class="history-date">${formatDate(order.order_date)}</span>
        </div>
        ${order.status !== 'PENDING' ? `
        <div class="history-item">
          <div class="history-dot" style="background:#1e40af"></div>
          <span>${status.label}${order.dispatched_by ? ' by ' + String(order.dispatched_by) : ''}</span>
          <span class="history-date">${formatDate(order.dispatched_at ?? order.updated_at)}</span>
        </div>` : ''}
        ${order.status === 'RECEIVED' ? `
        <div class="history-item">
          <div class="history-dot" style="background:#065f46"></div>
          <span>Received at site${order.received_by ? ' by ' + String(order.received_by) : ''}</span>
          <span class="history-date">${formatDate(order.received_at ?? order.updated_at)}</span>
        </div>` : ''}
      </div>
    </div>

    ${(orderStatus === 'DISPATCHED' || orderStatus === 'PARTIAL_DISPATCH' || orderStatus === 'RECEIVED') ? `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:8px 0 24px;padding:0 2px">
      <div>
        <div style="border-top:0.5px solid rgba(0,0,0,0.2);padding-top:10px;margin-top:8px">
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);letter-spacing:0.07em;text-transform:uppercase">Dispatched by</div>
          <div style="font-size:13px;color:rgba(0,0,0,0.6);margin-top:3px">${order.dispatched_by ? String(order.dispatched_by) : 'Stores / Warehouse'}</div>
          ${order.dispatched_at ? `<div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px">${formatDate(order.dispatched_at)}</div>` : ''}
        </div>
      </div>
      <div>
        <div style="border-top:0.5px solid rgba(0,0,0,0.2);padding-top:10px;margin-top:8px">
          <div style="font-size:10px;font-weight:600;color:rgba(0,0,0,0.35);letter-spacing:0.07em;text-transform:uppercase">Received by</div>
          <div style="font-size:13px;color:rgba(0,0,0,0.6);margin-top:3px">${order.received_by ? String(order.received_by) : String(order.contact_name ?? order.site_name ?? '')}</div>
          ${order.received_at ? `<div style="font-size:11px;color:rgba(0,0,0,0.35);margin-top:2px">${formatDate(order.received_at)}</div>` : ''}
        </div>
      </div>
    </div>
    ` : ''}

    <div class="action-bar no-print">
      <button class="btn-secondary" onclick="window.print()">&#8595; Download / Print PDF</button>
      ${canMarkReceived ? `<button class="btn-success" id="receiveBtn" onclick="markReceived(${String(order.id)})">&#10003; Mark as Received</button>` : ''}
      ${order.status === 'RECEIVED' ? `<div class="received-msg">&#10003; This order has been received</div>` : ''}
    </div>
  </div>

  <script>
    async function markReceived(orderId) {
      var btn = document.getElementById('receiveBtn');
      if (!btn) return;
      btn.textContent = 'Updating\u2026';
      btn.disabled = true;
      try {
        var res = await fetch('/api/orders/' + orderId + '/receive', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' }
        });
        var data = await res.json();
        if (res.ok) {
          btn.style.display = 'none';
          var msg = document.createElement('div');
          msg.className = 'received-msg';
          msg.textContent = '\u2713 Marked as received. Thank you!';
          btn.parentElement.appendChild(msg);
          var badge = document.getElementById('statusBadge');
          if (badge) {
            badge.textContent = 'Received';
            badge.style.background = '#d1fae5';
            badge.style.color = '#065f46';
          }
        } else {
          btn.textContent = '\u2713 Mark as Received';
          btn.disabled = false;
          alert('Failed: ' + (data.error || 'Unknown error'));
        }
      } catch(e) {
        btn.textContent = '\u2713 Mark as Received';
        btn.disabled = false;
        alert('Network error. Please try again.');
      }
    }
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[order-view]', err);
    return new NextResponse('Error loading order', { status: 500 });
  }
}
