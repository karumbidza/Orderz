// ORDERZ-ORDERVIEW
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { requireAdminAuth } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  const sql = neon(process.env.DATABASE_URL!);
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    if (isNaN(orderId)) {
      return new NextResponse('Not found', { status: 404 });
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
          o.dispatched_at,
          o.dispatched_by,
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
      return new NextResponse('Not found', { status: 404 });
    }

    const order = { ...(orders[0] as Record<string, unknown>), status: (orders[0] as Record<string, unknown>).order_status as string } as Record<string, unknown>;
    const orderItems = items as Record<string, unknown>[];

    const formatDate = (d: unknown): string => {
      if (!d) {
        return new Date().toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        });
      }
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

    const itemRows = orderItems
      .map((item) => {
        const qty =
          (item.qty_dispatched as number) ??
          (item.qty_approved as number) ??
          (item.qty_requested as number) ??
          0;
        return `
      <tr>
        <td>${item.sku ?? '&mdash;'}</td>
        <td>${item.item_name ?? '&mdash;'}${item.size ? ` <span style="color:rgba(0,0,0,0.45);font-size:11px">${item.size}</span>` : ''}</td>
        <td style="text-align:center">${qty}</td>
        <td style="text-align:right">${Number(item.unit_cost ?? 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(item.line_total ?? 0).toFixed(2)}</td>
      </tr>`;
      })
      .join('');

    const cityAddress = [order.city, order.address].filter(Boolean).join(' &middot; ');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dispatch Note &mdash; ${order.voucher_number ?? '#' + String(order.id)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', Arial, sans-serif; color: #0a0a0a; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #0a0a0a; }
    .brand-name { font-size: 28px; font-weight: 600; letter-spacing: -1px; }
    .doc-type { font-size: 12px; color: rgba(0,0,0,0.45); margin-top: 4px; font-weight: 400; letter-spacing: 0.05em; text-transform: uppercase; }
    .doc-meta { text-align: right; font-size: 13px; }
    .doc-meta strong { font-size: 18px; font-weight: 600; display: block; letter-spacing: -0.5px; }
    .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 28px; padding: 20px; background: #f8f8f6; border-radius: 10px; }
    .info-label { font-size: 10px; font-weight: 600; color: rgba(0,0,0,0.4); letter-spacing: 0.07em; text-transform: uppercase; margin-bottom: 3px; }
    .info-value { font-size: 14px; font-weight: 500; }
    .info-sub { font-size: 12px; color: rgba(0,0,0,0.45); }
    table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    thead tr { background: #0a0a0a; color: #fff; }
    th { padding: 10px 14px; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; text-align: left; }
    th:nth-child(3) { text-align: center; }
    th:nth-child(4), th:nth-child(5) { text-align: right; }
    td { padding: 10px 14px; font-size: 13px; border-bottom: 0.5px solid rgba(0,0,0,0.07); }
    td:nth-child(3) { text-align: center; }
    td:nth-child(4), td:nth-child(5) { text-align: right; }
    .total-section { display: flex; justify-content: flex-end; align-items: center; gap: 32px; padding: 16px 14px; border-top: 2px solid #0a0a0a; margin-bottom: 40px; }
    .total-label { font-size: 13px; color: rgba(0,0,0,0.45); }
    .total-amount { font-size: 24px; font-weight: 600; letter-spacing: -0.5px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 40px; }
    .sig-line { border-top: 0.5px solid rgba(0,0,0,0.25); padding-top: 8px; }
    .sig-label { font-size: 11px; color: rgba(0,0,0,0.4); }
    .sig-name { font-size: 12px; margin-top: 2px; color: rgba(0,0,0,0.6); }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 0.5px solid rgba(0,0,0,0.1); font-size: 11px; color: rgba(0,0,0,0.35); display: flex; justify-content: space-between; }
    .action-buttons { display: flex; gap: 10px; margin-bottom: 24px; }
    .btn { padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; border: none; }
    .btn-dark { background: #0a0a0a; color: #fff; }
    .btn-light { background: #f3f4f6; color: #0a0a0a; border: 0.5px solid rgba(0,0,0,0.12); }
    @media print {
      .action-buttons { display: none; }
      body { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="action-buttons">
    <button class="btn btn-dark" onclick="window.print()">Print / Save as PDF</button>
    <button class="btn btn-light" onclick="window.close()">Close</button>
  </div>

  <div class="header">
    <div>
      <div class="brand-name">Redan</div>
      <div class="doc-type">Dispatch Note</div>
    </div>
    <div class="doc-meta">
      <strong>${order.voucher_number ?? '#' + String(order.id)}</strong>
      Dispatched: ${formatDate(order.dispatched_at ?? new Date().toISOString())}
    </div>
  </div>

  <div class="info-section">
    <div>
      <div class="info-label">Deliver To</div>
      <div class="info-value">${order.site_name ?? '&mdash;'}</div>
      ${cityAddress ? `<div class="info-sub">${cityAddress}</div>` : ''}
      ${order.contact_name ? `<div class="info-sub" style="margin-top:4px">Attn: ${String(order.contact_name)}${order.phone ? ' &middot; ' + String(order.phone) : ''}</div>` : ''}
    </div>
    <div>
      <div style="margin-bottom:12px">
        <div class="info-label">Category</div>
        <div class="info-value">${order.category ?? '&mdash;'}</div>
      </div>
      <div>
        <div class="info-label">Order Date</div>
        <div class="info-value">${formatDate(order.order_date)}</div>
      </div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>SKU</th>
        <th>Description</th>
        <th>Qty</th>
        <th>Unit Cost</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows || '<tr><td colspan="5" style="padding:20px;text-align:center;color:rgba(0,0,0,0.4)">No items found</td></tr>'}
    </tbody>
  </table>

  <div class="total-section">
    <span class="total-label">Total Order Value</span>
    <span class="total-amount">${Number(order.total_amount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
  </div>

  <div class="signatures">
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Dispatched by</div>
      <div class="sig-name">${order.dispatched_by ? String(order.dispatched_by) : 'Stores / Warehouse'}</div>
    </div>
    <div>
      <div class="sig-line"></div>
      <div class="sig-label">Received by</div>
      <div class="sig-name">${order.contact_name ? String(order.contact_name) : (order.site_name ? String(order.site_name) : '')}</div>
    </div>
  </div>

  <div class="footer">
    <span>Redan &mdash; Internal Stock Document</span>
    <span>${order.voucher_number ?? '#' + String(order.id)} &middot; ${new Date().toLocaleDateString('en-GB')}</span>
  </div>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[dispatch-note]', err);
    return new NextResponse('Error generating dispatch note', { status: 500 });
  }
}
