# Orders Export to .xlsx — Design Spec

**Date:** 2026-05-04
**Author:** brainstormed with Allen
**Status:** Draft, pending implementation plan

## Problem

Allen needs to send a list of pending orders to category-specific suppliers (e.g. all PENDING Uniforms orders to the uniforms supplier so they can fulfil them). Today the only export options are: per-order dispatch-note PDFs (one at a time) and a `LoadVoucherHistory` Excel-side dump that's site-scoped and aimed at the requesting site, not at suppliers. There's no admin-side bulk export with the columns a supplier actually needs (employee names for uniform lines, qty pending, voucher links).

This spec defines a new admin-only "Download .xlsx" feature on the Orders tab that exports the currently-filtered view as a single-sheet `.xlsx` workbook, suitable for emailing directly to a supplier.

## Goals

- One click on the Orders tab produces a downloadable `.xlsx` matching the active filters.
- Supplier opens the file in Excel and immediately sees a flat, sortable, filterable list of what they owe (which sites, which SKUs, which sizes, which employee, qty pending, voucher links).
- Server-side ownership of column contract — UI cannot accidentally drift the column set.
- Filename communicates scope at a glance (`redan-orders-uniforms-pending-2026-05-04.xlsx`).
- Defensive cap on row count so a runaway filter doesn't time out the Vercel function or crash Excel.

## Non-goals (explicit YAGNI)

- **No** multi-sheet workbook (summary + line items). Single `Orders` sheet only.
- **No** saved filter presets or scheduled email exports.
- **No** CSV alternative endpoint.
- **No** SUM / total formulas in the workbook — data only; the supplier can compute their own totals.
- **No** editing of `orders.notes` via the admin UI as part of this work. (Separate follow-up: ORDERZ-VBA-NOTES — capture order-level notes in the Excel form's `SubmitOrder`. The export's Notes column will be blank for newly-placed orders until that ticket lands.)
- **No** additional auth surface — reuses `requireAdminAuth()`.
- **No** UI changes outside the Orders tab filter bar.

## Architecture

```
                  ┌──────────────────────────────────────┐
                  │  Admin UI — Orders tab               │
                  │  Existing Status / Category / Site   │
                  │  filters + new "↓ Download .xlsx"    │
                  │  button.                             │
                  └─────────────────┬────────────────────┘
                                    │  GET /api/admin/orders/export?
                                    │       status=…&category=…&pending_only=…
                                    ▼
                  ┌──────────────────────────────────────┐
                  │  app/api/admin/orders/export/route.ts │
                  │  1. requireAdminAuth                  │
                  │  2. Zod-validate query params         │
                  │  3. Single join SQL (LIMIT 5001)      │
                  │  4. Reject if 0 or > 5000 rows        │
                  │  5. Call buildOrdersWorkbook(...)     │
                  │  6. Stream xlsx with Content-Disp.    │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │  lib/orders-export.ts                 │
                  │  buildOrdersWorkbook(rows,           │
                  │                       filters,        │
                  │                       baseUrl)        │
                  │  Pure: rows in → Buffer out          │
                  │  Uses exceljs                         │
                  └──────────────────────────────────────┘
```

## User-facing behaviour

On the **Orders tab** (`/admin` → Orders), the existing filter row gets a new button after the filters:

```
[Status: Pending ▾] [Category: Uniforms ▾] [Site: All ▾] [Search...]   [↓ Download .xlsx]
```

When clicked:

1. Browser fetches `/api/admin/orders/export?<filters>`.
2. Server streams an `.xlsx` file. Browser saves to default download folder.
3. If the filter result is empty, a JSON 400 comes back; UI shows toast `"No orders match the current filter — adjust filters and try again."`
4. If the filter result exceeds 5000 line items, a JSON 400 comes back; UI shows toast `"Too many orders to export. Narrow your filter (e.g. add a date range)."`

Filename pattern: `redan-orders-<scope>-YYYY-MM-DD.xlsx` where `<scope>` is built from the active filters:

| Filters | Filename |
|---|---|
| `status=PENDING&category=Uniforms` | `redan-orders-uniforms-pending-2026-05-04.xlsx` |
| `status=PENDING` (no category) | `redan-orders-pending-2026-05-04.xlsx` |
| `category=Stationery` (no status) | `redan-orders-stationery-2026-05-04.xlsx` |
| no filters | `redan-orders-all-2026-05-04.xlsx` |

Slugify by lowercasing and replacing spaces with hyphens.

## Endpoint contract

**Method + path:** `GET /api/admin/orders/export`

**Auth:** `requireAdminAuth()` — Clerk session, same as all other `/api/admin/*` routes.

**Query parameters (all optional, AND-combined):**

| Param | Type | Default | Notes |
|---|---|---|---|
| `status` | repeated string (array) | none | one or more of `PENDING`, `PARTIAL_DISPATCH`, `DISPATCHED`, `RECEIVED`, `DECLINED`. Sent as repeated `?status=PENDING&status=PARTIAL_DISPATCH`. SQL: `status IN (...)`. |
| `category` | repeated string (array) | none | one or more category names. Same repeated-param shape. SQL: `category IN (...)`. |
| `site_search` | string (max 100) | none | case-insensitive substring match on `sites.name`. SQL: `LOWER(s.name) LIKE LOWER('%' || $param || '%')`. |
| `from` | YYYY-MM-DD | none | inclusive lower bound on `orders.order_date` |
| `to` | YYYY-MM-DD | none | inclusive upper bound on `orders.order_date` |
| `amount_min` | number | none | inclusive lower bound on `orders.total_amount` |
| `amount_max` | number | none | inclusive upper bound on `orders.total_amount` |
| `pending_only` | boolean | `true` | when true, only include line items where `qty_requested - COALESCE(qty_dispatched, 0) > 0` |

UI default values when the user clicks Download: `pending_only=true`, plus whatever filters are active in the Orders tab (multi-status, multi-category, site search, date range, amount range). The export endpoint accepts the same filter shape the existing `loadOrders()` UI applies client-side, so the file matches the visible table.

**Reconciliation amendment (post-spec):** original spec assumed single-value `status`, `category`, and `site_id`. The actual Orders tab UI has multi-select for status and category (state vars `orderStatuses: string[]`, `orderCategories: string[]`) and a site-name search box (`orderSiteSearch: string`). Updated above to match. Also added `amount_min` / `amount_max` to mirror the existing UI's amount filter.

**Successful response:**

- `200 OK`
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- `Content-Disposition: attachment; filename="<filename>"`
- `Cache-Control: no-store`
- Body: binary `.xlsx` stream

**Error responses:**

| HTTP | When | Body shape |
|---|---|---|
| 400 | Zod validation failure (bad date, unknown status, etc.) | `{success:false, error:"<details>"}` |
| 400 | Empty result set | `{success:false, error:"No orders match the current filter."}` |
| 400 | Result > 5000 rows | `{success:false, error:"Too many rows. Narrow your filter."}` |
| 401 / 403 | Not signed in / not admin | (whatever `requireAdminAuth` returns) |
| 500 | Unexpected (DB, exceljs) | `{success:false, error:"Failed to generate export."}` (full detail logged server-side, never exposed) |

## Column layout

Single sheet named `Orders`, header row 1 frozen, bold + light-grey fill on row 1.

| # | Header | Source | Format | Width |
|---|---|---|---|---|
| 1 | Voucher | `orders.voucher_number` | text | 16 |
| 2 | Order Date | `orders.order_date` | `yyyy-mm-dd` | 12 |
| 3 | Status | `orders.status` | text | 16 |
| 4 | Site | `sites.name` | text | 24 |
| 5 | City | `sites.city` | text | 18 |
| 6 | Category | `orders.category` | text | 12 |
| 7 | Requested By | `orders.requested_by` | text | 20 |
| 8 | SKU | `order_items.sku` | text | 22 |
| 9 | Product | `order_items.item_name` | text | 28 |
| 10 | Size | `order_items.size` | text | 10 |
| 11 | Qty Ordered | `order_items.qty_requested` | integer | 11 |
| 12 | Qty Dispatched | `COALESCE(order_items.qty_dispatched, 0)` | integer | 11 |
| 13 | Qty Pending | `qty_requested - COALESCE(qty_dispatched, 0)` | integer | 11 |
| 14 | Unit Cost | `order_items.unit_cost` | `#,##0.00` | 12 |
| 15 | Line Total (Pending) | `qty_pending × unit_cost` | `#,##0.00` | 16 |
| 16 | Employee Name | `order_items.employee_name` | text | 24 |
| 17 | Notes | `orders.notes` | text | 32 |
| 18 | Voucher Link | `<baseUrl>/api/excel/order-view/<orders.id>` | hyperlink (display = "Open"), styled blue underline | 14 |

Sort order: `order_date DESC, voucher_number ASC, sku ASC` — newest orders first; within an order, items grouped by SKU.

`baseUrl` is derived from `request.url` (i.e., `new URL(request.url).origin`) so the link always self-references the deployment that produced the export. Works in production, preview, and dev without env juggling.

## Data model

No DB migrations required. All columns already exist:

- `orders` — `id`, `voucher_number`, `category`, `status`, `total_amount`, `order_date`, `requested_by`, `notes`, `site_id`
- `order_items` — `sku`, `item_name`, `size`, `employee_name`, `qty_requested`, `qty_dispatched`, `unit_cost`
- `sites` — `name`, `city`

## Backend query

Single SQL with three joins and parameterised filters. Roughly:

```sql
SELECT
  o.id           AS order_id,
  o.voucher_number,
  o.order_date,
  o.status,
  o.category,
  o.requested_by,
  o.notes,
  s.name         AS site_name,
  s.city         AS site_city,
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
  ($1::text  IS NULL OR o.status     = $1)
  AND ($2::text IS NULL OR o.category   = $2)
  AND ($3::int  IS NULL OR o.site_id    = $3)
  AND ($4::date IS NULL OR o.order_date >= $4)
  AND ($5::date IS NULL OR o.order_date <= $5)
  AND ($6::bool = false OR oi.qty_requested > COALESCE(oi.qty_dispatched, 0))
ORDER BY o.order_date DESC, o.voucher_number ASC, oi.sku ASC
LIMIT 5001;
```

Reading 5001 rows (one over the cap) lets the route detect overflow before generating the workbook.

## Library choice

Add `exceljs` (^4.x) to `dependencies` in `package.json`. Reasons:

- Solid, mature, actively maintained
- Server-side native (Node Buffer output)
- Supports per-cell number formats, hyperlinks, freeze panes, column widths, conditional fills
- Doesn't require a build-time native step (pure JS)
- ~700 KB unpacked — fine on Vercel

`xlsx` (SheetJS) was considered: it's smaller and more popular but has known issues with the open-source build's hyperlink and number-format handling, and the licensing model is awkward for new projects.

## File layout

| File | Responsibility | Lines (est.) |
|---|---|---|
| `app/api/admin/orders/export/route.ts` | Route handler: auth → validate → query → build → stream | ~120 |
| `lib/orders-export.ts` | `buildOrdersWorkbook(rows, filters, baseUrl)` — pure xlsx builder | ~140 |
| `lib/validations.ts` | Add `OrderExportFiltersSchema` (Zod) | +20 |
| `app/admin/page.tsx` | New "↓ Download .xlsx" button on Orders tab filter row | +15 |
| `package.json` | Add `exceljs` dep | +1 |
| `scripts/test-orders-export.ts` | Ad-hoc tsx test for `buildOrdersWorkbook` (no test framework in repo) | new, ~80 |

The `lib/orders-export.ts` split keeps the workbook logic pure and testable: feed it rows, get back a Buffer. The route handler stays thin — auth, query, stream.

## Validation rules

| Layer | Rule |
|---|---|
| Zod | `status` must be one of the allowed enum values (or absent) |
| Zod | `from` / `to` must be parseable `YYYY-MM-DD` (or absent) |
| Zod | `from <= to` if both present |
| Route handler | If query returns 0 rows → 400 "No orders match the current filter." |
| Route handler | If query returns >5000 rows → 400 "Too many rows. Narrow your filter." |
| Route handler | Wrap exceljs call in try/catch — log full detail server-side, return generic 500 |

## Testing plan

Manual + ad-hoc script (no test framework in this repo):

1. **`scripts/test-orders-export.ts`** — calls `buildOrdersWorkbook` with synthetic rows; writes the buffer to `/tmp/test.xlsx`; user can open it in Excel to eyeball formatting.
2. **Curl smoke (admin auth via Clerk)** — open in browser:
   - `…/api/admin/orders/export?status=PENDING&category=Uniforms` → expect download
   - `…/api/admin/orders/export?status=PENDING&category=DOES_NOT_EXIST` → expect 400 "No orders…"
   - Open downloaded file, verify all 18 columns, employee names appear on uniform rows, voucher links are clickable.
3. **UI smoke** — navigate to Orders tab, set filters, click Download, verify file lands and matches the visible table.

## Acceptance criteria

- Clicking "↓ Download .xlsx" on the Orders tab produces a `.xlsx` file matching the active filters.
- The file opens in Excel without warnings.
- Header row is bold with light-grey fill; row 1 is frozen.
- All 18 columns are present in the order specified above.
- For Uniforms orders, the Employee Name column shows the value from `order_items.employee_name`; blank for non-uniform rows.
- The Voucher Link column is a clickable hyperlink that opens the public order-view page in a browser.
- Filter result of 0 rows returns 400 with a sensible UI toast.
- Filter result > 5000 rows returns 400 with a sensible UI toast.
- The endpoint requires admin auth (anonymous request returns 401/403).
- No regressions: nothing else on `/admin` breaks; existing filter behaviour unchanged.

## Open dependencies / follow-ups

- **ORDERZ-VBA-NOTES** — wire order-level Notes capture in the Excel `SubmitOrder` so the Notes column has content for new orders.
- **ORDERZ-EXPORT-RESEND** — future: an "email this export to <supplier>" button. Not in this scope.
- **ORDERZ-EXPORT-PRESETS** — future: save common filter combinations. Not in this scope.
