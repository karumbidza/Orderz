// ORDERZ-EXPORT — pure xlsx builder for the orders export endpoint.
import ExcelJS from 'exceljs';
import type { OrderExportFilters } from './validations';

export interface OrdersExportRow {
  order_id: number;
  voucher_number: string;
  order_date: Date;
  status: string;
  category: string | null;
  requested_by: string | null;
  notes: string | null;
  site_name: string | null;
  site_city: string | null;
  sku: string;
  item_name: string;
  size: string | null;
  qty_requested: number;
  qty_dispatched: number;
  unit_cost: number;
  employee_name: string | null;
}

const COLUMNS: { header: string; key: string; width: number; numFmt?: string }[] = [
  { header: 'Voucher',              key: 'voucher',           width: 16 },
  { header: 'Order Date',           key: 'order_date',        width: 12, numFmt: 'yyyy-mm-dd' },
  { header: 'Status',               key: 'status',            width: 16 },
  { header: 'Site',                 key: 'site',              width: 24 },
  { header: 'City',                 key: 'city',              width: 18 },
  { header: 'Category',             key: 'category',          width: 12 },
  { header: 'Requested By',         key: 'requested_by',      width: 20 },
  { header: 'SKU',                  key: 'sku',               width: 22 },
  { header: 'Product',              key: 'product',           width: 28 },
  { header: 'Size',                 key: 'size',              width: 10 },
  { header: 'Qty Ordered',          key: 'qty_ordered',       width: 11 },
  { header: 'Qty Dispatched',       key: 'qty_dispatched',    width: 11 },
  { header: 'Qty Pending',          key: 'qty_pending',       width: 11 },
  { header: 'Unit Cost',            key: 'unit_cost',         width: 12, numFmt: '#,##0.00' },
  { header: 'Line Total (Pending)', key: 'line_total_pending',width: 16, numFmt: '#,##0.00' },
  { header: 'Employee Name',        key: 'employee_name',     width: 24 },
  { header: 'Notes',                key: 'notes',             width: 32 },
  { header: 'Voucher Link',         key: 'voucher_link',      width: 14 },
];

export async function buildOrdersWorkbook(
  rows: OrdersExportRow[],
  _filters: OrderExportFilters,
  baseUrl: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Redan Orderz';
  wb.created = new Date();

  const ws = wb.addWorksheet('Orders', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
    style: c.numFmt ? { numFmt: c.numFmt } : undefined,
  }));

  for (const r of rows) {
    const qty_pending = r.qty_requested - (r.qty_dispatched ?? 0);
    const line_total_pending = round2(qty_pending * (r.unit_cost ?? 0));
    const linkUrl = `${baseUrl}/api/excel/order-view/${r.order_id}`;

    ws.addRow({
      voucher: r.voucher_number,
      order_date: r.order_date,
      status: r.status,
      site: r.site_name ?? '',
      city: r.site_city ?? '',
      category: r.category ?? '',
      requested_by: r.requested_by ?? '',
      sku: r.sku,
      product: r.item_name,
      size: r.size ?? '',
      qty_ordered: r.qty_requested,
      qty_dispatched: r.qty_dispatched ?? 0,
      qty_pending,
      unit_cost: r.unit_cost ?? 0,
      line_total_pending,
      employee_name: r.employee_name ?? '',
      notes: r.notes ?? '',
      voucher_link: { text: 'Open', hyperlink: linkUrl },
    });
  }

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFEFEFEF' },
  };
  headerRow.alignment = { vertical: 'middle' };

  for (let i = 2; i <= rows.length + 1; i++) {
    const cell = ws.getRow(i).getCell(18);
    cell.font = { color: { argb: 'FF1155CC' }, underline: true };
  }

  return Buffer.from(await wb.xlsx.writeBuffer());
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildExportFilename(
  filters: Pick<OrderExportFilters, 'status' | 'category' | 'pending_only'>,
  today: Date,
): string {
  const parts: string[] = ['redan-orders'];

  let categorySeg: string | null = null;
  if (filters.category && filters.category.length === 1) categorySeg = slug(filters.category[0]);
  else if (filters.category && filters.category.length > 1) categorySeg = 'multi';
  if (categorySeg) parts.push(categorySeg);

  let statusSeg: string | null = null;
  if (filters.status && filters.status.length === 1) statusSeg = slug(filters.status[0]);
  else if (filters.status && filters.status.length > 1) statusSeg = 'multi';
  if (statusSeg) parts.push(statusSeg);

  if (parts.length === 1) parts.push('all');
  parts.push(formatDate(today));

  return `${parts.join('-')}.xlsx`;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function formatDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
