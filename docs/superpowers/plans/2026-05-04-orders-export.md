# Orders Export to .xlsx — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Download .xlsx" button to the admin Orders tab that exports the currently-filtered orders as a single-sheet `.xlsx` workbook, ready to email to a category-specific supplier.

**Architecture:** New `GET /api/admin/orders/export` endpoint. Filters arrive as query params (status[], category[], site_search, date range, amount range, pending_only). Single SQL join (orders + order_items + sites, capped at 5001 rows) feeds a pure `buildOrdersWorkbook` function that returns an xlsx Buffer via `exceljs`. Route streams the buffer with `Content-Disposition: attachment`. UI button on the Orders tab fetches the endpoint with current filter state, downloads via blob URL, surfaces 400 errors as a toast.

**Tech Stack:** Next.js 14 (app router), Postgres via `@neondatabase/serverless`, Zod 3, **`exceljs` 4.x (new dep)**, Clerk admin auth via `requireAdminAuth()`. No test framework — verification via `tsx` scripts that write workbook buffers to `/tmp` for re-parsing.

**Linked spec:** `docs/superpowers/specs/2026-05-04-orders-export-design.md`

---

## File structure

| File | Purpose | Change type |
|---|---|---|
| `package.json` / `package-lock.json` | Add `exceljs` 4.x | Modify |
| `lib/validations.ts` | New `OrderExportFiltersSchema` Zod schema | Modify |
| `lib/orders-export.ts` | Pure `buildOrdersWorkbook(rows, filters, baseUrl)` builder + `buildExportFilename(filters, today)` helper | Create |
| `app/api/admin/orders/export/route.ts` | `GET` route handler: auth → validate → SQL → reject 0 / cap → build → stream | Create |
| `app/admin/page.tsx` | "↓ Download .xlsx" button on Orders tab; fetch + blob + toast | Modify |
| `scripts/test-orders-export.ts` | Ad-hoc tsx test for `buildOrdersWorkbook` + `buildExportFilename` | Create |

The split keeps `lib/orders-export.ts` pure (no DB, no auth, no `request`) so it's testable with synthetic rows. The route handler stays thin.

---

## Task 1: Install `exceljs` dependency

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Install**

```bash
npm install exceljs@^4.4.0
```

Expected: `package.json` `dependencies` gains `"exceljs": "^4.4.0"`.

- [ ] **Step 2: Verify install**

```bash
node -e "const x = require('exceljs'); console.log(typeof x.Workbook);"
```

Expected: `function`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add exceljs dependency for orders export"
```

---

## Task 2: Add `OrderExportFiltersSchema` to `lib/validations.ts`

**Files:**
- Modify: `lib/validations.ts` (append)
- Create: `scripts/test-orders-export.ts`

- [ ] **Step 1: Write the failing test**

Create `scripts/test-orders-export.ts` with this content:

```typescript
// Ad-hoc tsx checks for the orders-export work.
// Run: npx tsx scripts/test-orders-export.ts

import { OrderExportFiltersSchema } from '../lib/validations';

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
  const r = OrderExportFiltersSchema.safeParse({ from: '2026-05-10', to: '2026-05-01' });
  check('rejects from > to', !r.success);
}
{
  const r = OrderExportFiltersSchema.safeParse({ amount_min: -1 });
  check('rejects negative amount_min', !r.success);
}

if (failures > 0) { console.error(`\n${failures} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed');
```

- [ ] **Step 2: Run, expect failure**

```bash
npx tsx scripts/test-orders-export.ts 2>&1 | head -10
```

Expected: import error — `OrderExportFiltersSchema` does not exist.

- [ ] **Step 3: Add schema to `lib/validations.ts`**

Append at end of `lib/validations.ts`:

```typescript
// ─────────────────────────────────────────────
// ORDERS EXPORT FILTERS (GET /api/admin/orders/export)
// Mirrors the Orders tab filter UI (multi-select status + category,
// site-name substring search, date range, amount range).
// ─────────────────────────────────────────────
const ExportStatusSchema = z.enum([
  'PENDING',
  'PARTIAL_DISPATCH',
  'DISPATCHED',
  'RECEIVED',
  'DECLINED',
]);

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid calendar date');

export const OrderExportFiltersSchema = z
  .object({
    status: z.array(ExportStatusSchema).optional(),
    category: z.array(z.string().min(1).max(50)).optional(),
    site_search: z.string().max(100).optional(),
    from: IsoDateSchema.optional(),
    to: IsoDateSchema.optional(),
    amount_min: z.coerce.number().min(0).optional(),
    amount_max: z.coerce.number().min(0).optional(),
    pending_only: z
      .union([z.boolean(), z.enum(['true', 'false'])])
      .default(true)
      .transform((v) => (v === true || v === 'true')),
  })
  .superRefine((f, ctx) => {
    if (f.from && f.to && f.from > f.to) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['to'],
        message: '`to` must be on or after `from`',
      });
    }
    if (
      f.amount_min !== undefined &&
      f.amount_max !== undefined &&
      f.amount_min > f.amount_max
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['amount_max'],
        message: '`amount_max` must be on or after `amount_min`',
      });
    }
  });

export type OrderExportFilters = z.infer<typeof OrderExportFiltersSchema>;
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx tsx scripts/test-orders-export.ts 2>&1 | tail -10
```

Expected: ends with `All checks passed`.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add lib/validations.ts scripts/test-orders-export.ts
git commit -m "feat(validations): add OrderExportFiltersSchema"
```

---

## Task 3: Pure workbook builder + filename helper (`lib/orders-export.ts`)

**Files:**
- Create: `lib/orders-export.ts`
- Modify: `scripts/test-orders-export.ts`

- [ ] **Step 1: Append failing tests to scripts/test-orders-export.ts**

Append before the final `if (failures > 0)` block:

```typescript
// ─── lib/orders-export.ts ───────────────────────────────────────────────────
import { buildOrdersWorkbook, buildExportFilename, type OrdersExportRow } from '../lib/orders-export';
import ExcelJS from 'exceljs';
import { writeFileSync } from 'fs';

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

{
  const buf = await buildOrdersWorkbook(
    sampleRows,
    { status: ['PENDING'], category: ['Uniforms'], pending_only: true },
    'https://orderz-one.vercel.app',
  );
  check('buildOrdersWorkbook returns non-empty Buffer',
    buf instanceof Buffer && buf.byteLength > 1000);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
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
}
```

- [ ] **Step 2: Run, expect failure**

```bash
npx tsx scripts/test-orders-export.ts 2>&1 | head -15
```

Expected: import error — `lib/orders-export` not found.

- [ ] **Step 3: Create `lib/orders-export.ts`**

```typescript
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

  return (await wb.xlsx.writeBuffer()) as Buffer;
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
```

- [ ] **Step 4: Run test, expect pass**

```bash
npx tsx scripts/test-orders-export.ts 2>&1 | tail -25
```

Expected: ends with `All checks passed`. Also writes `/tmp/test-orders-export.xlsx`.

- [ ] **Step 5: Visual eyeball (recommended)**

```bash
open /tmp/test-orders-export.xlsx
```

Expected in Excel: 18 columns, header row bold + grey, frozen below row 1, two data rows, voucher link clickable in column 18.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: empty.

- [ ] **Step 7: Commit**

```bash
git add lib/orders-export.ts scripts/test-orders-export.ts
git commit -m "feat(export): pure xlsx workbook builder + filename helper"
```

---

## Task 4: Route handler `/api/admin/orders/export`

**Files:** Create `app/api/admin/orders/export/route.ts`

- [ ] **Step 1: Start dev server in another terminal**

```bash
npm run dev
```

Wait for `▲ Next.js  ... Ready`.

- [ ] **Step 2: Create the route file**

`app/api/admin/orders/export/route.ts`:

```typescript
// ORDERZ-EXPORT
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { requireAdminAuth } from '@/lib/admin-auth';
import { OrderExportFiltersSchema } from '@/lib/validations';
import { buildOrdersWorkbook, buildExportFilename, type OrdersExportRow } from '@/lib/orders-export';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_ROWS = 5000;
const HARD_LIMIT = MAX_ROWS + 1;

export async function GET(request: NextRequest) {
  const authError = await requireAdminAuth();
  if (authError) return authError;

  const url = new URL(request.url);
  const sp = url.searchParams;

  const raw = {
    status: sp.getAll('status').length ? sp.getAll('status') : undefined,
    category: sp.getAll('category').length ? sp.getAll('category') : undefined,
    site_search: sp.get('site_search') ?? undefined,
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
    amount_min: sp.get('amount_min') ?? undefined,
    amount_max: sp.get('amount_max') ?? undefined,
    pending_only: sp.get('pending_only') ?? undefined,
  };
  const parsed = OrderExportFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid filters', details: parsed.error.errors },
      { status: 400 },
    );
  }
  const f = parsed.data;

  const statusArr = f.status ?? null;
  const categoryArr = f.category ?? null;
  const siteSearch = f.site_search ? `%${f.site_search.toLowerCase()}%` : null;
  const fromDate = f.from ?? null;
  const toDate = f.to ?? null;
  const amountMin = f.amount_min ?? null;
  const amountMax = f.amount_max ?? null;
  const pendingOnly = f.pending_only;

  let rawRows: Record<string, unknown>[];
  try {
    rawRows = (await sql`
      SELECT
        o.id              AS order_id,
        o.voucher_number,
        o.order_date,
        o.status,
        o.category,
        o.requested_by,
        o.notes,
        s.name            AS site_name,
        s.city            AS site_city,
        oi.sku,
        oi.item_name,
        oi.size,
        oi.qty_requested,
        COALESCE(oi.qty_dispatched, 0) AS qty_dispatched,
        oi.unit_cost,
        oi.employee_name
      FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN sites s        ON s.id        = o.site_id
      WHERE
        (${statusArr}::text[]   IS NULL OR o.status   = ANY(${statusArr}::text[]))
        AND (${categoryArr}::text[] IS NULL OR o.category = ANY(${categoryArr}::text[]))
        AND (${siteSearch}::text   IS NULL OR LOWER(s.name) LIKE ${siteSearch})
        AND (${fromDate}::date     IS NULL OR o.order_date >= ${fromDate}::date)
        AND (${toDate}::date       IS NULL OR o.order_date <= ${toDate}::date)
        AND (${amountMin}::numeric IS NULL OR o.total_amount >= ${amountMin})
        AND (${amountMax}::numeric IS NULL OR o.total_amount <= ${amountMax})
        AND (${pendingOnly}::boolean = false
             OR oi.qty_requested > COALESCE(oi.qty_dispatched, 0))
      ORDER BY o.order_date DESC, o.voucher_number ASC, oi.sku ASC
      LIMIT ${HARD_LIMIT}
    `) as Record<string, unknown>[];
  } catch (err) {
    console.error('[orders-export] SQL error', err);
    return NextResponse.json(
      { success: false, error: 'Failed to query orders' },
      { status: 500 },
    );
  }

  if (rawRows.length === 0) {
    return NextResponse.json(
      { success: false, error: 'No orders match the current filter.' },
      { status: 400 },
    );
  }
  if (rawRows.length > MAX_ROWS) {
    return NextResponse.json(
      { success: false, error: 'Too many rows to export. Narrow your filter (e.g. add a date range).' },
      { status: 400 },
    );
  }

  const rows: OrdersExportRow[] = rawRows.map((r) => ({
    order_id: Number(r.order_id),
    voucher_number: String(r.voucher_number ?? ''),
    order_date: r.order_date instanceof Date ? r.order_date : new Date(String(r.order_date)),
    status: String(r.status ?? ''),
    category: r.category == null ? null : String(r.category),
    requested_by: r.requested_by == null ? null : String(r.requested_by),
    notes: r.notes == null ? null : String(r.notes),
    site_name: r.site_name == null ? null : String(r.site_name),
    site_city: r.site_city == null ? null : String(r.site_city),
    sku: String(r.sku ?? ''),
    item_name: String(r.item_name ?? ''),
    size: r.size == null ? null : String(r.size),
    qty_requested: Number(r.qty_requested ?? 0),
    qty_dispatched: Number(r.qty_dispatched ?? 0),
    unit_cost: Number(r.unit_cost ?? 0),
    employee_name: r.employee_name == null ? null : String(r.employee_name),
  }));

  let buffer: Buffer;
  try {
    buffer = await buildOrdersWorkbook(rows, f, url.origin);
  } catch (err) {
    console.error('[orders-export] xlsx build error', err);
    return NextResponse.json(
      { success: false, error: 'Failed to generate export.' },
      { status: 500 },
    );
  }

  const filename = buildExportFilename(f, new Date());

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
```

- [ ] **Step 3: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: empty.

- [ ] **Step 4: Smoke — endpoint live, rejects unauthenticated**

```bash
curl -s -o /dev/null -w "%{http_code}\n" 'http://localhost:3000/api/admin/orders/export?status=PENDING'
```

Expected: `401` or `403`.

- [ ] **Step 5: Smoke — admin-authed via browser**

While signed in to `/admin`, hit:

```
http://localhost:3000/api/admin/orders/export?status=PENDING&category=Uniforms&pending_only=true
```

Expected: `redan-orders-uniforms-pending-2026-05-04.xlsx` downloads. Open in Excel → 18 columns, employee names visible on uniform rows, voucher links open the order-view page.

- [ ] **Step 6: Smoke — empty result**

```
http://localhost:3000/api/admin/orders/export?category=DOES_NOT_EXIST_ANYWHERE
```

Expected: 400 JSON with `"No orders match the current filter."`

- [ ] **Step 7: Commit**

```bash
git add app/api/admin/orders/export/route.ts
git commit -m "feat(api): GET /api/admin/orders/export — stream filtered orders as xlsx"
```

---

## Task 5: "Download .xlsx" button on Orders tab

**Files:** Modify `app/admin/page.tsx`

State vars to read: `orderStatuses`, `orderCategories`, `orderSiteSearch`, `orderDateFrom`, `orderDateTo`, `orderAmountMin`, `orderAmountMax`. We hardcode `pending_only=true` (supplier workflow).

- [ ] **Step 1: Confirm `showMessage` toast helper exists**

```bash
grep -n "showMessage" /Users/allen/Documents/PROJECTS/Orderz/app/admin/page.tsx | head -3
```

Note the actual name and signature. If not `showMessage`, use whatever the surrounding code uses. The handler below uses `showMessage(msg, 'error')`.

- [ ] **Step 2: Add the download handler**

In `app/admin/page.tsx`, immediately after `const viewOrder = async (orderId: number) => { ... };` (around line 620), add:

```typescript
  // ORDERZ-EXPORT — download filtered orders as .xlsx
  const downloadOrdersExport = async () => {
    const qs = new URLSearchParams();
    for (const s of orderStatuses) qs.append('status', s);
    for (const c of orderCategories) qs.append('category', c);
    if (orderSiteSearch.trim()) qs.set('site_search', orderSiteSearch.trim());
    if (orderDateFrom) qs.set('from', orderDateFrom);
    if (orderDateTo) qs.set('to', orderDateTo);
    if (orderAmountMin) qs.set('amount_min', orderAmountMin);
    if (orderAmountMax) qs.set('amount_max', orderAmountMax);
    qs.set('pending_only', 'true');

    try {
      const res = await fetch(`/api/admin/orders/export?${qs.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        let msg = 'Export failed.';
        try {
          const body = await res.json();
          if (body?.error) msg = String(body.error);
        } catch { /* non-JSON body */ }
        showMessage(msg, 'error');
        return;
      }

      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      const filename = m ? m[1] : `redan-orders-${new Date().toISOString().slice(0, 10)}.xlsx`;

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error('[export] failed', err);
      showMessage('Export failed (network error).', 'error');
    }
  };
```

- [ ] **Step 3: Add the button to the Orders tab sort bar**

Find this block (around line 1783):

```tsx
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 12, color: 'rgba(0,0,0,0.35)' }}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}{filteredOrders.length !== orders.length ? ` (filtered from ${orders.length})` : ''}</span>
```

Insert immediately **before** the `<div style={{ flex: 1 }} />`:

```tsx
                  <button
                    onClick={downloadOrdersExport}
                    title="Download the currently-filtered orders as an .xlsx workbook"
                    style={{
                      border: '0.5px solid rgba(0,0,0,0.12)',
                      borderRadius: 7,
                      padding: '4px 10px',
                      fontSize: 12,
                      fontFamily: 'inherit',
                      background: '#0a0a0a',
                      color: '#fff',
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    ↓ Download .xlsx
                  </button>
```

- [ ] **Step 4: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -10
```

Expected: empty.

- [ ] **Step 5: Smoke — happy path in browser**

At `/admin` Orders tab: set Status=Pending, Category=Uniforms → click `↓ Download .xlsx`. Expected: `redan-orders-uniforms-pending-2026-05-04.xlsx` downloads.

- [ ] **Step 6: Smoke — empty filter result shows toast**

Set filter combination that excludes everything → click `↓ Download .xlsx`. Expected: toast `"No orders match the current filter."`. No file downloads.

- [ ] **Step 7: Commit**

```bash
git add app/admin/page.tsx
git commit -m "feat(admin): Download .xlsx button on Orders tab"
```

---

## Task 6: Final smoke + lint + push

- [ ] **Step 1: Validation tests**

```bash
npx tsx scripts/test-orders-export.ts 2>&1 | tail -5
npm run test:validation 2>&1 | tail -5
```

Both: end with `All checks passed`.

- [ ] **Step 2: Typecheck**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | head -20
```

Expected: empty.

- [ ] **Step 3: Lint**

```bash
npm run lint 2>&1 | tail -20
```

Expected: no new errors.

- [ ] **Step 4: Comprehensive UI walkthrough**

In `/admin` Orders tab, run these scenarios:
1. Default view → Download. File contains all orders capped at 5000.
2. Status=Pending only → Download. Filename `redan-orders-pending-...`. Contents match UI table.
3. Status=Pending + Category=Uniforms → Download. Filename `redan-orders-uniforms-pending-...`. Every row populates Employee Name.
4. Date From + Date To → Download. Date range honoured.
5. Status=Dispatched (no longer pending) → expect "No orders match…" toast (because button hardcodes `pending_only=true`).
6. Sign out → click button → auth wall (redirect to sign-in or 401 toast).

- [ ] **Step 5: Push**

```bash
git push -u origin feature/orders-export
```

- [ ] **Step 6: Open PR**

If `gh` is authenticated, run `gh pr create` with title `feat(admin): orders export to .xlsx` and a body covering Summary, Test plan, and Out-of-scope follow-ups (ORDERZ-VBA-NOTES, ORDERZ-EXPORT-RESEND, ORDERZ-EXPORT-PRESETS). Otherwise share the GitHub URL printed by `git push` for the user to open it manually.

---

## Acceptance checklist (mirrors spec)

- [ ] Clicking "↓ Download .xlsx" on the Orders tab produces a `.xlsx` file matching active filters.
- [ ] File opens in Excel without warnings.
- [ ] Header row bold + light-grey fill; row 1 frozen.
- [ ] All 18 columns present in spec order.
- [ ] Employee Name populated on Uniforms line items, blank elsewhere.
- [ ] Voucher Link is a clickable hyperlink to the public order-view page.
- [ ] 0-row filter result returns 400 with toast.
- [ ] >5000-row filter result returns 400 with toast.
- [ ] Anonymous request returns 401/403.
- [ ] No regressions on other admin pages.
