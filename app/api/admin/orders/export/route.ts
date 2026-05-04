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
        AND (${fromDate}::date     IS NULL OR o.order_date::date >= ${fromDate}::date)
        AND (${toDate}::date       IS NULL OR o.order_date::date <= ${toDate}::date)
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

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
