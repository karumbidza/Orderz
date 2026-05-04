# Employee Name per Uniform Item — Design Spec

**Date:** 2026-05-04
**Author:** brainstormed with Allen
**Status:** Draft, pending implementation plan

## Problem

When a site manager places a Uniforms order through the Excel form, they need to record **which employee each line item is for** (e.g. one row of overalls for John Mukoki, another for Mary Banda). The system was originally designed to support this — `order_items.employee_name` exists in the database, the API already accepts it, and the admin UI already renders it — but on the Excel side the field never appears when "Uniforms" is selected, so the data never gets captured. As a result, the warehouse and HQ have no record of which uniforms went to which person.

This spec defines the work needed to make the per-item employee-name field functional end-to-end and enforce it server-side.

## Goals

- When a user selects `Category = Uniforms` in the Excel order form, an **EMPLOYEE NAME** column must appear in the items table (rows 17–36) and accept free-text entry per row.
- Submission must be blocked on the Excel side if any uniform line is missing an employee name.
- The API must reject any order with `category = 'Uniforms'` whose items omit an employee name (defence in depth).
- One row per (item × person). If three employees each get an overall, that's three rows.
- For non-Uniforms categories, the column stays hidden and `employee_name` is not stored.

## Non-goals (explicit YAGNI)

- **No** dropdown of employees or link to the `employees` table. Free text only — employees move sites often, so the canonical list is hard to keep current.
- **No** new "collected by" or "received by" field at dispatch time. (Considered and dropped.)
- **No** backfill of `employee_name` on historical orders. The column stays nullable for legacy rows.
- **No** in-place editing of `employee_name` after submission in the admin UI.
- **No** changes to `uniform_assignments` table or the `/api/uniforms` endpoints.
- **No** retiring or repurposing of `orders.dispatched_by` or `orders.received_by`.

## Architecture

```
                  ┌──────────────────────────────────────┐
                  │  Excel Order Form (Order Form sheet) │
                  │                                       │
                  │  E6 = "Uniforms"                      │
                  │  Items table rows 17-36:              │
                  │    EMPLOYEE NAME column (visible only │
                  │    when Uniforms; column letter set   │
                  │    to match actual workbook layout)   │
                  │  VBA validates non-empty per row      │
                  │  before submit                        │
                  └─────────────────┬────────────────────┘
                                    │ POST /api/excel/orders
                                    ▼
                  ┌──────────────────────────────────────┐
                  │  app/api/excel/orders/route.ts        │
                  │                                       │
                  │  Zod-validated payload                │
                  │  IF category = 'Uniforms':            │
                  │     reject if any item is missing     │
                  │     employee_name (HTTP 400)          │
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │  Postgres                             │
                  │  order_items.employee_name TEXT NULL  │
                  │  (column already exists in 008 schema)│
                  └─────────────────┬────────────────────┘
                                    │
                                    ▼
                  ┌──────────────────────────────────────┐
                  │  Admin UI (app/admin/page.tsx)        │
                  │  Shown under product name in drawer   │
                  │  Shown on dispatch-note PDF           │
                  └──────────────────────────────────────┘
```

## Data model

No DB migrations required. The relevant column already exists:

```sql
-- sql/008_refined_schema.sql:183
employee_name TEXT,  -- Employee name (denormalized, free text) for uniform orders
```

It stays nullable. Non-uniform rows continue to have `NULL` here.

## Component-by-component design

### 1. Excel workbook + VBA — the main fix (`excel/SiteOrderForm_V2.bas`)

The root cause of the field "not appearing" is a layout mismatch between the macro and the actual workbook in production. The `.bas` file in the repo expects:

| Col | B | C | D | E | F | G | H |
|-----|---|---|---|---|---|---|---|
| Header | Item | SKU | Qty | Unit | Cost | Total | Employee |

But the actual `Redan Order Voucher V2.0` workbook (per Allen's screenshot, 2026-05-04) has its items table laid out differently — the first visible column is `QNTY`, not `Item`. So when V2 calls `Columns("H").Hidden = False`, it unhides the wrong column (or an empty/unstyled column with no header).

**Decision: update the `.bas` to match the workbook**, not the other way round. The workbook's branded layout is preserved; the macro adapts.

Steps:

1. Open the actual `.xlsm` file and read the real header row (row 17). Determine which column letter is currently empty / available for the Employee field, or which column the team agrees should be repurposed. Capture this as the new value of `COL_EMPLOYEE`.
2. Update the column-letter constants (lines 35–41) and any hard-coded `"H"` references throughout the module so they match the actual workbook.
3. In the items header row (row 17 of the workbook), add an `EMPLOYEE NAME` label in the chosen column with consistent styling (column width ~20, light yellow tint matching V2's `RGB(255, 255, 230)` at line 796).
4. Verify the show/hide logic at lines 597–602 is invoked on `Worksheet_Change` for `E6`. If a `Worksheet_Change` event handler doesn't exist in `OrderFormSheet_Code.txt` for E6, add one that calls a public sub which re-runs the show/hide branch.
5. Verify the per-row validation at line 1000 fires correctly and lists the offending row number(s).
6. JSON serialisation at line 1012 should only emit `employee_name` when `category = "Uniforms"`. For other categories, omit the key (don't send `""`).

**Risk:** the implementation requires the actual `.xlsm` file. The `.bas` in the repo alone is not enough to verify the fix. The implementation plan must include "obtain the workbook from Allen and verify column layout" as a prerequisite step.

### 2. API — server-side enforcement (`app/api/excel/orders/route.ts`)

After parsing the payload (currently lines 199–206), add a guard:

```ts
if (category === 'Uniforms') {
  for (const it of items) {
    if (!it.employee_name || it.employee_name.trim().length < 2) {
      return NextResponse.json({
        success: false,
        error: `Item ${it.sku}: employee name is required for uniform orders.`,
      }, { status: 400 });
    }
  }
}
```

For non-Uniforms orders, ignore `employee_name` entirely — do not write it to `order_items` even if present in the payload (defensive: prevents accidental data leakage if a future client misuses the field). The current insert at line 307 already handles this correctly *if* the upstream payload doesn't carry the field for non-uniforms; we'll just normalise to `NULL` explicitly when category isn't Uniforms.

### 3. Zod validators (`lib/validations.ts`)

Add an optional `employee_name` to the existing `OrderItemCreateSchema` (lines 105–109), and a `superRefine` on the order-level schema that enforces presence on every item when `category === 'Uniforms'`. Keep the optional + conditional shape — non-uniforms shouldn't fail validation if the field is absent.

### 4. Types (`lib/types.ts`)

`OrderItemEnhanced` (lines 425–428) already includes `employee_name`. Audit consumers to confirm they use the enhanced type, not the bare `OrderItem`. Where the bare type is used in admin response paths, swap to `OrderItemEnhanced` so TypeScript surfaces the field. No new types needed.

### 5. Admin UI (`app/admin/page.tsx:2654`)

The drawer items table already renders `employee_name` as a sub-line under the product name. No change required here.

**Add to dispatch-note PDF** (`app/api/admin/orders/[id]/dispatch-note/route.ts`): include the employee name next to the product description for uniform orders, so the printed slip shows who each item is for. Inspect the existing template (around line 147 / 222) and weave it in.

### 6. Documentation

- Update `excel/EXCEL_TABLE_STRUCTURE.md` so the documented column layout matches the actual workbook (after step 1.1 nails down the real layout).
- Update `excel/SETUP_GUIDE.md` line 96 to point to the corrected column letter for employee name.
- No changes required to `SITE_MANAGER_GUIDE.md` or `SKU_REFERENCE.md`.

## Validation rules summary

| Layer | Rule |
|---|---|
| Excel VBA | Block `SubmitOrder` if `E6 = "Uniforms"` and any populated row has empty employee column. Show row number. |
| API (Zod) | `employee_name?: string`, with `superRefine` requiring non-empty when `category === 'Uniforms'`. |
| API (route handler) | Defensive re-check on `category === 'Uniforms'`; reject with 400 listing the offending SKU. |
| API (insert) | When `category !== 'Uniforms'`, normalise `employee_name` to `NULL` before insert. |

## Testing plan

- **Excel manual test:** Select Uniforms → verify column appears with header & yellow tint. Type item, leave employee blank, click Request → expect validation MsgBox naming the row, no submission. Fill in employee names → click Request → expect success.
- **Excel manual test:** Select PPE / Stationery / Consumable / HSSE → verify employee column hidden.
- **API contract test:** POST `/api/excel/orders` with `category: "Uniforms"` and an item missing `employee_name` → expect 400 with the SKU in the error message.
- **API contract test:** Same call but with `employee_name` present on every item → expect 200 and rows persisted with the names.
- **API contract test:** POST with `category: "PPE"` and `employee_name` populated → expect 200, but rows persisted with `employee_name = NULL`.
- **DB inspection:** `SELECT sku, employee_name FROM order_items WHERE order_id = <new_order>` → confirm names persisted.
- **Admin UI smoke test:** Open the order in the admin drawer → confirm employee name renders under each item.
- **Dispatch note smoke test:** Generate a dispatch note for a uniform order → confirm employee name appears next to each line.

## Open dependencies

- **The actual `.xlsm` workbook is required** to confirm the real column layout before the VBA fix can be implemented. Allen has it locally. The implementation plan must list "share workbook layout / obtain `.xlsm`" as the first step.

## Files touched (estimated)

1. `excel/SiteOrderForm_V2.bas` — column constants, show/hide logic, validation message, JSON serialisation.
2. `excel/OrderFormSheet_Code.txt` — `Worksheet_Change` handler for E6 (if missing).
3. `excel/EXCEL_TABLE_STRUCTURE.md` — documentation alignment.
4. `excel/SETUP_GUIDE.md` — corrected column reference.
5. The `.xlsm` workbook itself — header label + width + tint (one-time, manual).
6. `lib/validations.ts` — Zod schema update.
7. `lib/types.ts` — audit `OrderItem` vs `OrderItemEnhanced` usage.
8. `app/api/excel/orders/route.ts` — server-side enforcement, normalise NULL for non-uniforms.
9. `app/api/admin/orders/[id]/dispatch-note/route.ts` — render employee name in PDF.

## Acceptance criteria

- A new uniform order placed via Excel cannot be submitted without an employee name on every line.
- A uniform order placed via API cannot be persisted without an employee name on every line (HTTP 400).
- A non-uniform order is unaffected by the change — no new validation errors, no new required fields.
- The admin order-detail drawer continues to render `employee_name` under each item.
- The dispatch-note PDF for a uniform order shows the employee name next to each item line.
- `EXCEL_TABLE_STRUCTURE.md` accurately describes the actual workbook layout after the fix.
