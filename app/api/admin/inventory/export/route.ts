import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/inventory/export - Export inventory as CSV or HTML (printable PDF)
// Query params: format=csv|pdf
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'csv';

    // Get all stock items with current quantities
    const stock = await sql`
      SELECT 
        i.id as item_id,
        i.sku,
        i.category,
        i.product,
        i.role,
        i.size,
        i.unit,
        i.cost,
        COALESCE(sl.quantity_on_hand, 0) as quantity_on_hand,
        COALESCE(sl.quantity_on_hand, 0) * i.cost as stock_value,
        sl.last_updated
      FROM items i
      LEFT JOIN stock_levels sl ON i.id = sl.item_id AND sl.warehouse_id = 2
      WHERE i.is_active = true
      ORDER BY i.category, i.product, i.role, i.size
    `;

    // Calculate category totals
    const categoryTotals: Record<string, { qty: number; value: number; items: number }> = {};
    let grandTotalQty = 0;
    let grandTotalValue = 0;

    for (const item of stock) {
      const cat = item.category || 'Uncategorized';
      if (!categoryTotals[cat]) {
        categoryTotals[cat] = { qty: 0, value: 0, items: 0 };
      }
      categoryTotals[cat].qty += Number(item.quantity_on_hand) || 0;
      categoryTotals[cat].value += Number(item.stock_value) || 0;
      categoryTotals[cat].items += 1;
      grandTotalQty += Number(item.quantity_on_hand) || 0;
      grandTotalValue += Number(item.stock_value) || 0;
    }

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Category', 'Product', 'SKU', 'Role', 'Size', 'Unit', 'Unit Cost', 'Qty On Hand', 'Stock Value', 'Last Updated'];
      const rows = stock.map((item: any) => [
        item.category || '',
        item.product || '',
        item.sku || '',
        item.role || '',
        item.size || '',
        item.unit || '',
        `$${Number(item.cost || 0).toFixed(2)}`,
        item.quantity_on_hand || 0,
        `$${Number(item.stock_value || 0).toFixed(2)}`,
        item.last_updated ? new Date(item.last_updated).toLocaleDateString() : '-'
      ]);

      // Add category totals
      rows.push([]);
      rows.push(['=== CATEGORY TOTALS ===']);
      for (const [cat, totals] of Object.entries(categoryTotals)) {
        rows.push([cat, `${totals.items} items`, '', '', '', '', '', totals.qty, `$${totals.value.toFixed(2)}`, '']);
      }
      rows.push([]);
      rows.push(['GRAND TOTAL', `${stock.length} items`, '', '', '', '', '', grandTotalQty, `$${grandTotalValue.toFixed(2)}`, '']);

      const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
      
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="inventory-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    // Generate printable HTML/PDF
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Inventory Report - ${new Date().toLocaleDateString()}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; }
    .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #006633; padding-bottom: 15px; }
    .header h1 { color: #006633; font-size: 22px; }
    .header h2 { color: #333; font-size: 16px; margin-top: 5px; }
    .summary { display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap; }
    .summary-card { background: #f5f5f5; padding: 12px 20px; border-radius: 8px; text-align: center; flex: 1; min-width: 120px; }
    .summary-card .value { font-size: 20px; font-weight: bold; color: #006633; }
    .summary-card .label { font-size: 11px; color: #666; }
    .category-section { margin-bottom: 25px; page-break-inside: avoid; }
    .category-header { background: #006633; color: white; padding: 8px 12px; font-weight: bold; font-size: 13px; border-radius: 4px 4px 0 0; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #e8f5e9; padding: 6px 8px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
    td { padding: 5px 8px; border: 1px solid #ddd; }
    tr:nth-child(even) { background: #fafafa; }
    .number { text-align: right; }
    .category-total { background: #fff3cd !important; font-weight: bold; }
    .grand-total { background: #d4edda !important; font-weight: bold; font-size: 12px; }
    .size-badge { background: #e3f2fd; padding: 2px 6px; border-radius: 4px; font-size: 9px; }
    .low-stock { background: #ffebee !important; }
    .no-stock { background: #ffcdd2 !important; color: #c62828; }
    .footer { margin-top: 30px; text-align: center; color: #666; font-size: 10px; border-top: 1px solid #ddd; padding-top: 15px; }
    @media print {
      body { padding: 10px; }
      .no-print { display: none; }
      .category-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print" style="margin-bottom: 20px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; background: #006633; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px;">
      🖨️ Print / Save as PDF
    </button>
  </div>

  <div class="header">
    <h1>REDAN COUPON</h1>
    <h2>Inventory Report - ${new Date().toLocaleDateString()}</h2>
  </div>

  <div class="summary">
    <div class="summary-card">
      <div class="value">${stock.length}</div>
      <div class="label">Total Items</div>
    </div>
    <div class="summary-card">
      <div class="value">${grandTotalQty.toLocaleString()}</div>
      <div class="label">Total Qty</div>
    </div>
    <div class="summary-card">
      <div class="value">$${grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="label">Total Value</div>
    </div>
    ${Object.entries(categoryTotals).map(([cat, t]) => `
    <div class="summary-card">
      <div class="value">$${t.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
      <div class="label">${cat}</div>
    </div>
    `).join('')}
  </div>

  ${Object.entries(categoryTotals).map(([category, totals]) => {
    const categoryItems = stock.filter((i: any) => (i.category || 'Uncategorized') === category);
    return `
  <div class="category-section">
    <div class="category-header">${category} (${totals.items} items)</div>
    <table>
      <thead>
        <tr>
          <th style="width: 25%">Product</th>
          <th style="width: 15%">SKU</th>
          <th style="width: 10%">Role</th>
          <th style="width: 10%">Size</th>
          <th style="width: 8%">Unit</th>
          <th style="width: 10%" class="number">Unit Cost</th>
          <th style="width: 8%" class="number">Qty</th>
          <th style="width: 12%" class="number">Value</th>
        </tr>
      </thead>
      <tbody>
        ${categoryItems.map((item: any) => {
          const qty = Number(item.quantity_on_hand) || 0;
          const rowClass = qty === 0 ? 'no-stock' : qty <= 5 ? 'low-stock' : '';
          return `
        <tr class="${rowClass}">
          <td>${item.product || '-'}</td>
          <td><code style="font-size: 9px">${item.sku || '-'}</code></td>
          <td>${item.role || '-'}</td>
          <td>${item.size ? `<span class="size-badge">${item.size}</span>` : '-'}</td>
          <td>${item.unit || '-'}</td>
          <td class="number">$${Number(item.cost || 0).toFixed(2)}</td>
          <td class="number">${qty}</td>
          <td class="number">$${Number(item.stock_value || 0).toFixed(2)}</td>
        </tr>`;
        }).join('')}
        <tr class="category-total">
          <td colspan="6" style="text-align: right"><strong>${category} Total:</strong></td>
          <td class="number"><strong>${totals.qty}</strong></td>
          <td class="number"><strong>$${totals.value.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>`;
  }).join('')}

  <table style="margin-top: 20px;">
    <tr class="grand-total">
      <td colspan="6" style="text-align: right; padding: 10px;"><strong>GRAND TOTAL:</strong></td>
      <td class="number" style="padding: 10px;"><strong>${grandTotalQty.toLocaleString()}</strong></td>
      <td class="number" style="padding: 10px;"><strong>$${grandTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>
    </tr>
  </table>

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()} | Redan Coupon Order Management System</p>
    <p style="margin-top: 5px; color: #c62828;">⚠ Red rows indicate zero stock | Yellow rows indicate low stock (≤5)</p>
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
      },
    });

  } catch (error) {
    console.error('Error exporting inventory:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to export inventory: ' + String(error)
    }, { status: 500 });
  }
}
