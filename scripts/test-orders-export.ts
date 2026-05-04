// Ad-hoc tsx checks for the orders-export work.
// Run: npx tsx scripts/test-orders-export.ts

import { OrderExportFiltersSchema } from '../lib/validations';
import { buildOrdersWorkbook, buildExportFilename, type OrdersExportRow } from '../lib/orders-export';
import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

let failures = 0;
function check(label: string, condition: boolean) {
  if (condition) console.log(`  PASS  ${label}`);
  else { console.error(`  FAIL  ${label}`); failures++; }
}

{
  const r = OrderExportFiltersSchema.safeParse({});
  check('accepts empty filter (defaults pending_only=true)',
    r.success && r.data.pending_only === true);
}
{
  const r = OrderExportFiltersSchema.safeParse({
    status: ['PENDING', 'PARTIAL_DISPATCH'],
    category: ['Uniforms'],
    site_search: 'Beit',
    from: '2026-04-01',
    to: '2026-05-04',
    amount_min: 0,
    amount_max: 10000,
    pending_only: false,
  });
  check('accepts full filter set', r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ status: ['NOT_A_REAL_STATUS'] });
  check('rejects unknown status', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-13-99' });
  check('rejects malformed from date', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-02-30' });
  check('rejects calendar rollover (Feb 30)', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2025-02-29' });
  check('rejects non-leap-year Feb 29', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-05-10', to: '2026-05-01' });
  check('rejects from > to', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ amount_min: -1 });
  check('rejects negative amount_min', !r.success);
}

// ─── lib/orders-export.ts ───────────────────────────────────────────────────

const sampleRows: OrdersExportRow[] = [
  {
    order_id: 567, voucher_number: 'RV-2026-0489',
    order_date: new Date('2026-05-04T08:00:00Z'),
    status: 'PENDING', category: 'Uniforms',
    requested_by: 'Allen', notes: 'urgent',
    site_name: 'Seke', site_city: 'Harare',
    sku: 'UNI-SHI-CAS-XXXL', item_name: 'Shirt', size: 'XXXL',
    qty_requested: 1, qty_dispatched: 0,
    unit_cost: 29, employee_name: 'PETER DRURY',
  },
  {
    order_id: 567, voucher_number: 'RV-2026-0489',
    order_date: new Date('2026-05-04T08:00:00Z'),
    status: 'PENDING', category: 'Uniforms',
    requested_by: 'Allen', notes: 'urgent',
    site_name: 'Seke', site_city: 'Harare',
    sku: 'UNI-TRO-32', item_name: 'Trousers', size: '32',
    qty_requested: 2, qty_dispatched: 1,
    unit_cost: 15, employee_name: 'PETER DRURY',
  },
];

{
  const today = new Date('2026-05-04T12:00:00Z');
  check('filename: pending uniforms',
    buildExportFilename({ status: ['PENDING'], category: ['Uniforms'], pending_only: true }, today)
      === 'redan-orders-uniforms-pending-2026-05-04.xlsx');
  check('filename: no filters',
    buildExportFilename({ pending_only: true }, today)
      === 'redan-orders-all-2026-05-04.xlsx');
  check('filename: stationery only',
    buildExportFilename({ category: ['Stationery'], pending_only: true }, today)
      === 'redan-orders-stationery-2026-05-04.xlsx');
  check('filename: multiple categories collapse to multi',
    buildExportFilename({ category: ['Uniforms', 'PPE'], pending_only: true }, today)
      === 'redan-orders-multi-2026-05-04.xlsx');
  check('filename: status only',
    buildExportFilename({ status: ['DISPATCHED'], pending_only: false }, today)
      === 'redan-orders-dispatched-2026-05-04.xlsx');
}

(async () => {
  const buf = await buildOrdersWorkbook(
    sampleRows,
    { status: ['PENDING'], category: ['Uniforms'], pending_only: true },
    'https://orderz-one.vercel.app',
  );
  check('buildOrdersWorkbook returns non-empty Buffer',
    buf instanceof Buffer && buf.byteLength > 1000);

  const wb = new ExcelJS.Workbook();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await wb.xlsx.load(buf as any);
  const ws = wb.getWorksheet('Orders');
  check('workbook has Orders sheet', ws !== undefined);
  check('header row 1 col 1 = "Voucher"', ws!.getRow(1).getCell(1).value === 'Voucher');
  check('header row 1 col 18 = "Voucher Link"', ws!.getRow(1).getCell(18).value === 'Voucher Link');
  check('header row is bold', !!(ws!.getRow(1).font?.bold));
  check('frozen pane below header',
    !!(ws!.views?.[0]?.state === 'frozen' && ws!.views?.[0]?.ySplit === 1));
  check('row 2 voucher matches sample', ws!.getRow(2).getCell(1).value === 'RV-2026-0489');
  check('row 2 employee_name = PETER DRURY', ws!.getRow(2).getCell(16).value === 'PETER DRURY');
  check('row 2 qty_pending = 1', ws!.getRow(2).getCell(13).value === 1);
  check('row 3 qty_pending = 1', ws!.getRow(3).getCell(13).value === 1);
  check('row 2 line_total_pending = 29', Number(ws!.getRow(2).getCell(15).value) === 29);
  check('row 3 line_total_pending = 15', Number(ws!.getRow(3).getCell(15).value) === 15);

  const linkCell = ws!.getRow(2).getCell(18);
  const v = linkCell.value as { hyperlink?: string; text?: string } | string;
  const hyperlink = typeof v === 'object' && v ? v.hyperlink : undefined;
  check('row 2 voucher link points at order-view',
    hyperlink === 'https://orderz-one.vercel.app/api/excel/order-view/567');
  check('row 2 size = XXXL', ws!.getRow(2).getCell(10).value === 'XXXL');

  writeFileSync('/tmp/test-orders-export.xlsx', buf);
  console.log('\n  (workbook saved to /tmp/test-orders-export.xlsx)');

  if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
  console.log('\nAll checks passed');
})().catch((err) => { console.error(err); process.exit(1); });
