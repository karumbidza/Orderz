# Employee Name per Uniform Item — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `order_items.employee_name` functional end-to-end for Uniforms orders — fix the broken Excel column visibility, enforce non-empty server-side, and surface the field on the dispatch-note PDF.

**Architecture:** All persistence already exists (`order_items.employee_name TEXT NULL` from migration 008). Work is in three layers: (1) the Excel workbook + VBA macro need their column letters reconciled because the macro currently points at a column the actual workbook doesn't use as Employee, (2) the API needs a category-aware guard rejecting Uniforms orders missing the field, (3) the dispatch-note PDF needs to SELECT and render the field so the printed slip shows who each uniform is for.

**Tech Stack:** Next.js 14 (app router), Neon Postgres via `@neondatabase/serverless`, Zod 3, Excel VBA (macro module `SiteOrderForm_V2.bas`), `tsx` for ad-hoc Node scripts. No test framework — verification is via `tsx` scripts and `curl` against the local dev server.

**Linked spec:** `docs/superpowers/specs/2026-05-04-employee-name-per-uniform-item-design.md`

---

## File structure

| File | Purpose | Change type |
|---|---|---|
| `excel/SiteOrderForm_V2.bas` | VBA module: column constants, show/hide logic, validation MsgBox, JSON build | Modify |
| `excel/OrderFormSheet_Code.txt` | `Worksheet_Change` event handler bound to the Order Form sheet | Modify (verify/add) |
| `excel/EXCEL_TABLE_STRUCTURE.md` | Documentation of the workbook layout | Modify |
| `excel/SETUP_GUIDE.md` | User-facing setup notes referencing column letters | Modify |
| `Redan Order Voucher V2.0.xlsm` (workbook) | Items header row label + width + tint | Modify (manual, in Excel) |
| `lib/validations.ts` | Zod schema for order item — add optional `employee_name`, conditional rule | Modify |
| `app/api/excel/orders/route.ts` | Server-side enforcement: reject Uniforms missing employee_name; null out on non-Uniforms | Modify |
| `app/api/admin/orders/[id]/dispatch-note/route.ts` | SELECT `employee_name` + render in PDF | Modify |
| `scripts/test-employee-name-validation.ts` | Ad-hoc Zod check (positive + negative cases) | Create (temp, deletable after run) |

---

## Task 0: Prerequisites — confirm actual workbook column layout

**Purpose:** The macro in `SiteOrderForm_V2.bas` assumes Item=B, SKU=C, Qty=D, Unit=E, Cost=F, Total=G, Employee=H. Allen's screenshot showed the live workbook has a different layout. Before any code change, we read the *actual* header row from the `.xlsm` file.

**Status: COMPLETED 2026-05-04** by extracting `Redan Order Voucher V2.0 - Update.xlsm` (placed in repo root, not committed).

### Findings

The `R.Voucher` sheet (rId1 → sheet1.xml) has these layouts:

**Header cells (key fields):**
| Field | V2.bas constant | Live workbook actual |
|---|---|---|
| Voucher # | E4 | C3 |
| Date | E5 | C4 |
| Category | E6 | **C5** |
| Site Name | E9 | **C8** |
| Address | E10 | C10 |
| Town | G10 | C11 |
| T.M (email) | E12 | C12 |
| Phone | G12 | C13 |
| Manager | (none) | C14 |

**Items table (header at row 17, data rows 18–37):**
| Col | V2.bas constant | Live workbook actual |
|---|---|---|
| A | (none) | row number (1–20) |
| B | COL_ITEM | **QNTY** |
| C | COL_SKU | **ITEM** |
| D | COL_QTY | **SKU** |
| E | COL_UNIT | Unit of Measure ✓ |
| F | COL_COST | UNIT COST ✓ |
| G | COL_TOTAL | TOTAL ✓ |
| H | COL_EMPLOYEE | **(empty — available)** |

**Row offsets:**
| | V2.bas constant | Live workbook actual |
|---|---|---|
| ORDER_START_ROW | 17 | **18** (header is at 17) |
| ORDER_END_ROW | 36 | **37** |

### Implication — broader scope than the spec anticipated

The live workbook is significantly out of sync with `SiteOrderForm_V2.bas` — many constants (not just `COL_EMPLOYEE`) point at the wrong cells. This means `Worksheet_Change` listens for E6 / E9 (the V2 expectations) but the actual category and site cells are C5 / C8. So the macro in the repo cannot work as-shipped against this workbook.

**However:** the user reports orders *do* get submitted today, which strongly suggests the running VBA inside `vbaProject.bin` is *different* from what's in the repo `.bas`. The repo `.bas` may be aspirational / wishlist code for a layout that was later abandoned.

**Decision (in-scope):** for this feature, we make only the minimal changes needed for the EMPLOYEE column to work — add a header at H17 in the workbook, ensure show/hide on category change, and validate non-empty on submit. We do NOT attempt to reconcile the broader VBA/workbook drift; that's a separate effort the user should be made aware of.

**Decision (chosen `COL_EMPLOYEE` letter):** `H` — already empty in the workbook, sits cleanly to the right of TOTAL, and matches the existing V2.bas constant so the diff stays minimal.

**Decision (chosen header row / start row for VBA):** in this scope we update `COL_EMPLOYEE`-related code only. We do not touch ORDER_START_ROW because changing it would shift all downstream validation/JSON-build references and we have no way to test the result without running VBA. The user should re-test in Excel.

### Recommendation for Allen (out-of-scope follow-up)

Open a separate ticket: "Reconcile SiteOrderForm_V2.bas with the live workbook layout." The current `.bas` is broadly out of sync and any future macro re-import will break the workbook. Either: (a) align `.bas` to the live workbook (CELL_CATEGORY, CELL_SITE_NAME, COL_QTY, COL_ITEM, COL_SKU, ORDER_START_ROW, ORDER_END_ROW, plus OrderFormSheet_Code.txt event triggers), or (b) re-run FirstTimeSetup to regenerate the workbook from `.bas` (loses branding).

**Files:**
- Read: `Redan Order Voucher V2.0 - Update.xlsm` (in repo root, untracked)

- [ ] **Step 1: Ask Allen to send the live `.xlsm` file** (or have him open it and report cell-by-cell what's in row 17, columns A through J)

Expected response: a mapping like
```
B17 = QNTY
C17 = ITEM
D17 = (continuation of ITEM merge?)
E17 = SKU
F17 = Unit of Measure
G17 = UNIT COST
H17 = TOTAL
I17 = (empty)
```

- [ ] **Step 2: Decide which column letter becomes the Employee column**

Pick the first empty column to the right of TOTAL (likely `I` or `J`). Record this letter as `WORKBOOK_EMPLOYEE_COL` for use in later tasks. If no empty column exists in the visible range, decide together with Allen whether to insert a new column or reorder existing ones.

- [ ] **Step 3: Verify all the OTHER column constants match**

Walk down `SiteOrderForm_V2.bas` lines 35–41 against the live workbook. Note any mismatches besides Employee — they're separate bugs and should be fixed in the same VBA edit (Task 5).

| Constant | V2.bas value | Live workbook value |
|---|---|---|
| COL_ITEM | B | ? |
| COL_SKU | C | ? |
| COL_QTY | D | ? |
| COL_UNIT | E | ? |
| COL_COST | F | ? |
| COL_TOTAL | G | ? |
| COL_EMPLOYEE | H | (target letter from Step 2) |

- [ ] **Step 4: Record findings**

Append the mapping to the bottom of `excel/EXCEL_TABLE_STRUCTURE.md` under a new heading `## Live workbook layout (verified YYYY-MM-DD)` so future developers don't have to re-do this archaeology. Don't commit yet — bundle with Task 9.

---

## Task 1: Zod schema — add `employee_name` and Uniforms-conditional rule

**Files:**
- Modify: `lib/validations.ts:105-114`
- Create: `scripts/test-employee-name-validation.ts`

**Why have this schema if the route doesn't use it?** The current `/api/excel/orders` handler validates manually rather than via Zod. We add the schema anyway because (a) spec §3 calls for it as the canonical source of truth for the payload shape, (b) it's reused as a backstop in the curl probes, and (c) any future endpoint or admin tool consuming Excel-shaped order payloads (e.g. an import job) gets validation for free. If you're tempted to skip this task, re-read spec §3 first.

- [ ] **Step 1: Write the failing test script**

Create `scripts/test-employee-name-validation.ts`:

```typescript
// Ad-hoc Zod check for OrderItemCreateSchema with employee_name.
// Run: npx tsx scripts/test-employee-name-validation.ts
// Delete after the implementation lands.

import { OrderItemCreateSchema, ExcelOrderSchema } from '../lib/validations';

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  PASS  ${label}`);
  } else {
    console.error(`  FAIL  ${label}`);
    failures++;
  }
}

// Schema-level: employee_name is optional on the item itself
{
  const r = OrderItemCreateSchema.safeParse({ item_id: 1, quantity_ordered: 1 });
  check('OrderItemCreateSchema accepts item without employee_name', r.success);
}
{
  const r = OrderItemCreateSchema.safeParse({ item_id: 1, quantity_ordered: 1, employee_name: 'Jane Doe' });
  check('OrderItemCreateSchema accepts item with employee_name', r.success);
}

// Order-level: Uniforms requires employee_name on every item
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [{ sku: 'UNI-001', quantity: 1 }],
  });
  check('ExcelOrderSchema rejects Uniforms order with missing employee_name', !r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [{ sku: 'UNI-001', quantity: 1, employee_name: 'Jane Doe' }],
  });
  check('ExcelOrderSchema accepts Uniforms order with employee_name', r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'PPE',
    items: [{ sku: 'PPE-001', quantity: 5 }],
  });
  check('ExcelOrderSchema accepts non-Uniforms order without employee_name', r.success);
}
{
  const r = ExcelOrderSchema.safeParse({
    site_code: 'HAR-001',
    category: 'Uniforms',
    items: [
      { sku: 'UNI-001', quantity: 1, employee_name: 'Jane Doe' },
      { sku: 'UNI-002', quantity: 1, employee_name: '   ' },
    ],
  });
  check('ExcelOrderSchema rejects Uniforms order where one item has whitespace-only employee_name', !r.success);
}

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll checks passed');
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npx tsx scripts/test-employee-name-validation.ts`

Expected: import error (`ExcelOrderSchema` does not exist) or all "Uniforms required" checks fail.

- [ ] **Step 3: Update `lib/validations.ts`**

Replace the existing `OrderItemCreateSchema` block (lines 102–114) with:

```typescript
// ─────────────────────────────────────────────
// ORDER ITEMS
// ─────────────────────────────────────────────
export const OrderItemCreateSchema = z.object({
  item_id: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  notes: z.string().max(500).nullable().optional(),
  employee_name: z.string().max(255).nullable().optional(),
});

export const OrderItemBatchSchema = z.object({
  order_id: z.number().int().positive(),
  items: z.array(OrderItemCreateSchema).min(1),
});

// ─────────────────────────────────────────────
// EXCEL ORDER PAYLOAD (POST /api/excel/orders)
// Mirrors the JSON shape that SiteOrderForm_V2.bas builds.
// Items reference SKU + quantity, not item_id.
// ─────────────────────────────────────────────
const ExcelOrderItemSchema = z.object({
  sku: z.string().min(1).max(50),
  quantity: z.number().int().positive(),
  size: z.string().max(50).nullable().optional(),
  employee_name: z.string().max(255).nullable().optional(),
});

export const ExcelOrderSchema = z.object({
  voucher_number: z.string().max(50).nullable().optional(),
  site_code: z.string().min(1).max(50),
  category: z.string().max(50).nullable().optional(),
  ordered_by: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  items: z.array(ExcelOrderItemSchema).min(1),
}).superRefine((order, ctx) => {
  if (order.category === 'Uniforms') {
    order.items.forEach((it, idx) => {
      const name = (it.employee_name ?? '').trim();
      if (name.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', idx, 'employee_name'],
          message: `Item ${it.sku}: employee name is required for uniform orders.`,
        });
      }
    });
  }
});
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npx tsx scripts/test-employee-name-validation.ts`

Expected output ends with: `All checks passed`

- [ ] **Step 5: Commit**

```bash
git add lib/validations.ts scripts/test-employee-name-validation.ts
git commit -m "feat(validations): add employee_name + Uniforms-conditional rule to ExcelOrderSchema"
```

---

## Task 1b: Types audit — confirm `OrderItem` consumers

**Files:**
- Read: `lib/types.ts`, `app/admin/page.tsx:67-80`, `app/api/orders/[id]/items/route.ts`

Spec §4 calls for an audit of `OrderItem` vs `OrderItemEnhanced`. This is purely a verification step — only modify if you find an admin response path returning bare `OrderItem` to a consumer that needs `employee_name`.

- [ ] **Step 1: Confirm admin page declares its own `OrderItem` interface with `employee_name`**

```bash
grep -n "interface OrderItem" /Users/allen/Documents/PROJECTS/Orderz/app/admin/page.tsx
```

Expected: line ~67 declares a local interface that already includes `employee_name: string | null`. **No change needed** — confirmed in spec.

- [ ] **Step 2: Confirm the only consumer of `lib/types.ts:OrderItem` is unrelated**

```bash
grep -rn "from '@/lib/types'" /Users/allen/Documents/PROJECTS/Orderz/app /Users/allen/Documents/PROJECTS/Orderz/lib --include="*.ts" --include="*.tsx" | grep -v "OrderItemEnhanced\|OrderItemWithDetails"
```

Expected: at most one hit, in `app/api/orders/[id]/items/route.ts`. That route adds line items by `item_id` (not the Excel SKU shape); it's not part of the Uniforms flow. Leave it alone.

- [ ] **Step 3: No commit — purely a verification step**

If Steps 1–2 produced different results, escalate before changing types: surfacing `employee_name` on the shared `OrderItem` may have ripple effects on other endpoints. Ask Allen.

---

## Task 2: API route — add server-side guard for Uniforms

**Files:**
- Modify: `app/api/excel/orders/route.ts:196-215`

We won't retrofit Zod onto this route (its existing style is manual destructure-and-check); we'll add a focused guard in the same style, using the schema from Task 1 only as a backup safety net.

- [ ] **Step 1: Start the dev server in another terminal**

```bash
npm run dev
```

Wait for `▲ Next.js  ... Ready`.

- [ ] **Step 2: Capture the local Excel API key**

```bash
grep EXCEL_API_KEY .env.local
```

Save the value as `$KEY` in your shell:

```bash
export KEY="<value-from-env-local>"
```

- [ ] **Step 3: Write a failing curl probe — Uniforms order with no employee_name should fail (it currently succeeds)**

Use a real `site_code` and `sku` from your DB. Quick lookup:

```bash
psql $DATABASE_URL -c "SELECT site_code FROM sites LIMIT 1;"
psql $DATABASE_URL -c "SELECT sku FROM items WHERE category = 'Uniforms' LIMIT 1;"
```

Then probe (replace `HAR-001` and `UNI-001` with real values):

```bash
curl -s -X POST http://localhost:3000/api/excel/orders \
  -H "Content-Type: application/json" \
  -H "x-excel-api-key: $KEY" \
  -d '{
    "site_code": "HAR-001",
    "category": "Uniforms",
    "ordered_by": "test",
    "items": [{"sku":"UNI-001","quantity":1}]
  }' | jq .
```

Expected (current, broken behaviour): `{"success": true, ...}` with the order persisted. **This is the bug.**

- [ ] **Step 4: Add the guard in the route handler**

In `app/api/excel/orders/route.ts`, after line 214 (the `items` array check) and before the site lookup at line 217, insert:

```typescript
    // ORDERZ-UNIFORM-NAME — require employee_name on every line for Uniforms orders
    if (category === 'Uniforms') {
      for (const item of items) {
        const name = typeof item?.employee_name === 'string' ? item.employee_name.trim() : '';
        if (name.length === 0) {
          return errorResponse(
            `Item ${item?.sku ?? '(unknown)'}: employee name is required for uniform orders.`,
            400
          );
        }
      }
    }
```

- [ ] **Step 5: Re-run the failing probe, expect 400**

Same curl as Step 3. Expected:

```json
{ "success": false, "error": "Item UNI-001: employee name is required for uniform orders." }
```

HTTP status: 400.

- [ ] **Step 6: Run the positive case — Uniforms with employee_name should succeed**

```bash
curl -s -X POST http://localhost:3000/api/excel/orders \
  -H "Content-Type: application/json" \
  -H "x-excel-api-key: $KEY" \
  -d '{
    "site_code": "HAR-001",
    "category": "Uniforms",
    "ordered_by": "test",
    "items": [{"sku":"UNI-001","quantity":1,"employee_name":"Jane Doe"}]
  }' | jq .
```

Expected: `{"success": true, "data": {"order_id": <N>, ...}}`

- [ ] **Step 7: Confirm employee_name persisted**

```bash
psql $DATABASE_URL -c "SELECT id, sku, employee_name FROM order_items WHERE order_id = (SELECT MAX(id) FROM orders);"
```

Expected: row with `employee_name = 'Jane Doe'`.

- [ ] **Step 8: Commit**

```bash
git add app/api/excel/orders/route.ts
git commit -m "feat(api): reject Uniforms orders missing employee_name (ORDERZ-UNIFORM-NAME)"
```

---

## Task 3: API route — null out `employee_name` for non-Uniforms

**Files:**
- Modify: `app/api/excel/orders/route.ts:267-324`

The current code unconditionally writes `employee_name` if the payload has it (line 318). For non-Uniforms orders we don't want this — keep the column NULL to avoid storing meaningless data.

- [ ] **Step 1: Probe — PPE order with employee_name should currently leak it into DB**

```bash
curl -s -X POST http://localhost:3000/api/excel/orders \
  -H "Content-Type: application/json" \
  -H "x-excel-api-key: $KEY" \
  -d '{
    "site_code": "HAR-001",
    "category": "PPE",
    "ordered_by": "test",
    "items": [{"sku":"<a-real-PPE-sku>","quantity":1,"employee_name":"Should Not Persist"}]
  }' | jq .

psql $DATABASE_URL -c "SELECT sku, employee_name FROM order_items WHERE order_id = (SELECT MAX(id) FROM orders);"
```

Expected (current bug): `employee_name = 'Should Not Persist'`. The leak is real.

- [ ] **Step 2: Fix — only insert employee_name when category is Uniforms**

In `app/api/excel/orders/route.ts`, replace the insert at line 297–321 (the whole `INSERT INTO order_items ... RETURNING ...` block) with:

```typescript
      // Only persist employee_name for Uniforms; null for everything else.
      const persistedEmployeeName = category === 'Uniforms' ? (employee_name ?? null) : null;

      // Insert order item with correct column names
      const orderItemResult = await sql`
        INSERT INTO order_items (
          order_id,
          item_id,
          sku,
          item_name,
          qty_requested,
          unit_cost,
          line_total,
          size,
          employee_name
        )
        VALUES (
          ${order.id},
          ${dbItem.id},
          ${sku},
          ${dbItem.product},
          ${quantity},
          ${unitCost},
          ${lineTotal},
          ${size || dbItem.size || null},
          ${persistedEmployeeName}
        )
        RETURNING id, sku, item_name, qty_requested, unit_cost, line_total
      `;
```

- [ ] **Step 3: Re-run the probe, expect NULL**

Same curl as Step 1, then:

```bash
psql $DATABASE_URL -c "SELECT sku, employee_name FROM order_items WHERE order_id = (SELECT MAX(id) FROM orders);"
```

Expected: `employee_name | (null)`.

- [ ] **Step 4: Verify Uniforms still persists names (regression check)**

Re-run Task 2 Step 6, then Task 2 Step 7. Expect `employee_name = 'Jane Doe'` on the new row.

- [ ] **Step 5: Commit**

```bash
git add app/api/excel/orders/route.ts
git commit -m "fix(api): null out employee_name on non-Uniforms order items"
```

---

## Task 4: Dispatch-note PDF — render employee_name for Uniforms lines

**Files:**
- Modify: `app/api/admin/orders/[id]/dispatch-note/route.ts:47-61` (SELECT)
- Modify: `app/api/admin/orders/[id]/dispatch-note/route.ts:91-106` (item row template)

Currently the SQL query (lines 47–61) doesn't even select `employee_name`, so the PDF can't render it.

- [ ] **Step 1: Visual smoke test of current state — confirm employee_name is missing**

Find a recent uniform order ID:

```bash
psql $DATABASE_URL -c "SELECT id, voucher_number FROM orders WHERE category = 'Uniforms' ORDER BY id DESC LIMIT 1;"
```

Open in browser: `http://localhost:3000/api/admin/orders/<id>/dispatch-note` (must be logged in as admin).

Expected: items table has Item / SKU / Ordered / Dispatched / Pending / Unit Cost / Total — **no employee name visible**.

- [ ] **Step 2: Add `employee_name` to the SELECT**

In `app/api/admin/orders/[id]/dispatch-note/route.ts`, modify the second `sql` template literal (lines 47–61). Add `oi.employee_name,` after `oi.size,`:

```typescript
      sql`
        SELECT
          oi.id,
          oi.sku,
          oi.item_name,
          oi.size,
          oi.employee_name,
          oi.qty_requested,
          oi.qty_approved,
          oi.qty_dispatched,
          oi.unit_cost,
          oi.line_total
        FROM order_items oi
        WHERE oi.order_id = ${orderId}
        ORDER BY oi.item_name
      `,
```

- [ ] **Step 3: Render employee_name under the item name**

In the same file, the item row template is at lines 91–106. Modify the first `<td>` (currently rendering `item_name` + size) to also render `employee_name` on a second line when present:

Replace this line (line 98):

```typescript
        <td>${item.item_name ?? '&mdash;'}${item.size ? ` <span style="color:rgba(255,255,255,0.55);font-size:10px">${item.size}</span>` : ''}</td>
```

With:

```typescript
        <td>
          ${item.item_name ?? '&mdash;'}${item.size ? ` <span style="color:rgba(0,0,0,0.45);font-size:10px">${item.size}</span>` : ''}
          ${item.employee_name ? `<div style="font-size:11px;color:rgba(0,0,0,0.55);margin-top:2px">For: ${String(item.employee_name)}</div>` : ''}
        </td>
```

(Note: I also corrected the size colour from `rgba(255,255,255,0.55)` — invisible on the white row background — to `rgba(0,0,0,0.45)`. If that was intentional, revert to original.)

- [ ] **Step 4: Reload the dispatch note in browser, expect employee_name to show**

Hard-refresh the dispatch-note URL from Step 1. Expected: each line item shows the product name on top, and underneath it `For: <employee name>` in light grey, when an employee name is set.

For non-Uniforms orders (no employee_name on rows), the layout is unchanged.

- [ ] **Step 5: Commit**

```bash
git add app/api/admin/orders/[id]/dispatch-note/route.ts
git commit -m "feat(dispatch-note): show employee name per line for uniform orders"
```

---

## Task 5: VBA — repoint `COL_EMPLOYEE` to the actual workbook column

**Depends on Task 0.** Cannot proceed without Allen's confirmed column letter.

**Files:**
- Modify: `excel/SiteOrderForm_V2.bas:35-41`
- Modify: `excel/SiteOrderForm_V2.bas:597-602` (no code change, but verify references)
- Modify: `excel/SiteOrderForm_V2.bas:766` (header label cell)
- Modify: `excel/SiteOrderForm_V2.bas:825-836` (column widths + initial hide)

- [ ] **Step 1: Substitute the column letter constants**

In `SiteOrderForm_V2.bas`, find the column constants block (lines 35–41). Replace each constant whose value disagrees with Task 0 Step 3's table. Specifically, change `COL_EMPLOYEE` from `"H"` to the value chosen in Task 0 Step 2 (call it `<E>`). Also change any other constants that didn't match.

- [ ] **Step 2: Update `Range("H...")` references that bypass the constant**

The constants are mostly used, but a few places use literal `"H"`. Grep:

```bash
grep -n '"H"\|"H1"\|"H16"\|Range("H' /Users/allen/Documents/PROJECTS/Orderz/excel/SiteOrderForm_V2.bas
```

For each match (e.g. `ws.Columns("H").Hidden = True` at line 836, `ws.Range("H16").Value = "Employee"` at line 766), replace the literal `"H"` with the new column letter `<E>` and `"H16"` with `<E> & "16"` (or the chosen header row).

- [ ] **Step 3: Update column-width and hide-initially logic**

Lines 825–836 set widths column-by-column. After substitution, the new Employee column needs:

```vba
ws.Columns("<E>").ColumnWidth = 20

' Hide employee column initially
ws.Columns("<E>").Hidden = True
```

If the new letter slot was previously assigned a different width, restore that to the column it belongs to (e.g. if Employee is now `J`, give `J` width 20 and re-give `H` whatever its real-world content needs).

- [ ] **Step 4: Verify by importing into a copy of the workbook**

In Excel: File → Save As → make a copy of `Redan Order Voucher V2.0.xlsm`. Open the copy. Alt+F11 → File → Import File → pick the modified `.bas`. Run `UpdateItemDropdowns` (or whatever sub triggers the show/hide on category change). Set E6 to `Uniforms`, then to `PPE`, then back to `Uniforms`.

Expected: the column at letter `<E>` is hidden when E6 ≠ Uniforms, visible when E6 = Uniforms.

- [ ] **Step 5: Commit (.bas only — workbook is local)**

```bash
git add excel/SiteOrderForm_V2.bas
git commit -m "fix(vba): repoint COL_EMPLOYEE to actual workbook column"
```

---

## Task 6: VBA — verify or add `Worksheet_Change` handler for E6

**Files:**
- Modify (verify): `excel/OrderFormSheet_Code.txt`

The show/hide branch at `SiteOrderForm_V2.bas:597-602` only runs when something explicitly calls `UpdateItemDropdowns` (or whatever sub contains it). It must be triggered when the user changes E6.

- [ ] **Step 1: Inspect existing sheet code**

```bash
cat /Users/allen/Documents/PROJECTS/Orderz/excel/OrderFormSheet_Code.txt
```

Look for an existing `Private Sub Worksheet_Change(ByVal Target As Range)` that handles `Target.Address = "$E$6"`.

- [ ] **Step 2a: If a handler exists for E6**

Verify it calls the public sub from `SiteOrderForm_V2.bas` that contains the show/hide branch (likely `UpdateItemDropdowns`). If yes, no change. If no, edit it to call the right sub.

- [ ] **Step 2b: If no handler exists**

Append to `excel/OrderFormSheet_Code.txt`:

```vba
Private Sub Worksheet_Change(ByVal Target As Range)
    On Error GoTo CleanExit

    ' E6 = category dropdown — re-run dropdown + employee column visibility
    If Not Intersect(Target, Me.Range("E6")) Is Nothing Then
        Application.EnableEvents = False
        Call UpdateItemDropdowns
    End If

    ' B17:B36 = item selected — auto-fill SKU/unit/cost
    If Not Intersect(Target, Me.Range("B17:B36")) Is Nothing Then
        Application.EnableEvents = False
        Call OnItemSelected(Target.Row)
    End If

CleanExit:
    Application.EnableEvents = True
End Sub
```

(Adjust column/row references if Task 5 chose different letters.)

- [ ] **Step 3: Re-import sheet code into the workbook copy and test**

In the Excel copy from Task 5 Step 4, delete the existing sheet-module code, paste the contents of `OrderFormSheet_Code.txt`. Toggle E6 between Uniforms and PPE.

Expected: the Employee column shows/hides each time E6 changes, without manually running a macro.

- [ ] **Step 4: Commit**

```bash
git add excel/OrderFormSheet_Code.txt
git commit -m "fix(vba): trigger employee column show/hide on E6 change"
```

---

## Task 7: Workbook — header label, width, tint (manual one-shot)

**Files:**
- The actual `.xlsm` file (not in repo)

- [ ] **Step 1: In the live workbook, set the Employee header cell**

Open `Redan Order Voucher V2.0.xlsm`. Navigate to `<E>17` (where `<E>` is the letter chosen in Task 0 Step 2). Set value to `EMPLOYEE NAME`. Bold, centred, same font as adjacent headers.

- [ ] **Step 2: Set column width and tint**

Select column `<E>`. Right-click → Column Width → 20. Select cells `<E>18:<E>36`. Format → Cells → Fill → custom RGB(255, 255, 230) (the V2 yellow used at `SiteOrderForm_V2.bas:796`).

- [ ] **Step 3: Re-import the latest `.bas` and `OrderFormSheet_Code.txt`**

Same as Task 5 Step 4 — but on the *real* live workbook (back it up first).

- [ ] **Step 4: Test end-to-end in Excel**

- Set Site, set Category = Uniforms.
- Pick an item in row 18, leave Employee blank, click Request.
- Expected: MsgBox "Row 1: Uniform items require an EMPLOYEE NAME in column `<E>`." Selection lands on `<E>18`.
- Type a name in `<E>18`, click Request again. Expected: success message with new voucher number.

- [ ] **Step 5: No git commit**

The `.xlsm` is not in the repo. Allen keeps the workbook locally. Confirm with him that he saved his changes.

---

## Task 8: VBA — confirm validation MsgBox and JSON serialisation gating

**Files:**
- Modify: `excel/SiteOrderForm_V2.bas:991-1015`

The current validation (lines 1000–1003) uses `column H` in its message. After Task 5 the column letter changes; the user-facing message should reflect that. Also: line 1012 unconditionally writes `employee_name` into the JSON; it should only do so when `category = "Uniforms"` to avoid confusing the API.

- [ ] **Step 1: Update the MsgBox text**

Find the `MsgBox` at line ~1001:

```vba
MsgBox "Row " & (i - ORDER_START_ROW + 1) & ": Uniform items require an EMPLOYEE NAME in column H.", _
       vbExclamation, "Missing Employee"
```

Replace `column H` with `column ` & `COL_EMPLOYEE`:

```vba
MsgBox "Row " & (i - ORDER_START_ROW + 1) & ": Uniform items require an EMPLOYEE NAME in column " & COL_EMPLOYEE & ".", _
       vbExclamation, "Missing Employee"
```

- [ ] **Step 2: Gate the JSON `employee_name` field on category**

Around line 1009–1013 the JSON is built. Wrap the `employee_name` field in a conditional:

```vba
' Only emit employee_name when the order is a Uniforms order
Dim itemBody As String
itemBody = "{""sku"":""" & EscapeJSON(sku) & """," & _
           """quantity"":" & qty
If category = "Uniforms" Then
    itemBody = itemBody & "," & _
               """employee_name"":""" & EscapeJSON(employeeName) & """"
End If
itemBody = itemBody & "}"
```

(Adjust to match the surrounding code's variable names — read the actual block before pasting.)

- [ ] **Step 3: Test in the workbook**

- Place a Uniforms order with an employee → confirm employee_name persists in DB.
- Place a PPE order → confirm `employee_name` is NULL in DB (Task 3 also enforces this server-side, so this is belt-and-braces).

```bash
psql $DATABASE_URL -c "SELECT sku, employee_name FROM order_items WHERE order_id = (SELECT MAX(id) FROM orders);"
```

- [ ] **Step 4: Commit**

```bash
git add excel/SiteOrderForm_V2.bas
git commit -m "fix(vba): correct MsgBox column reference and gate employee_name JSON on category"
```

---

## Task 9: Documentation — align with reality

**Files:**
- Modify: `excel/EXCEL_TABLE_STRUCTURE.md`
- Modify: `excel/SETUP_GUIDE.md:96`

- [ ] **Step 1: Update `EXCEL_TABLE_STRUCTURE.md`**

Append (or replace, if already drafted in Task 0 Step 4) a section:

```markdown
## Live workbook layout (verified 2026-05-04)

| Column | Header | Notes |
|---|---|---|
| B | QNTY | Quantity |
| C | ITEM | Product name (dropdown) |
| ... | ... | ... |
| `<E>` | EMPLOYEE NAME | Visible only when Category = Uniforms |
```

Fill in the actual rows from Task 0 Step 3.

- [ ] **Step 2: Update `SETUP_GUIDE.md` line 96**

Find the existing reference to "column H" for employee. Replace with the corrected letter.

- [ ] **Step 3: Commit**

```bash
git add excel/EXCEL_TABLE_STRUCTURE.md excel/SETUP_GUIDE.md
git commit -m "docs(excel): update column layout to match live workbook"
```

---

## Task 10: End-to-end smoke test

- [ ] **Step 1: Place a uniform order via Excel**

Site: pick one. Category: Uniforms. Two line items:
- Row 18: an actual UNI- SKU, qty 1, Employee = `Test Person A`.
- Row 19: another UNI- SKU, qty 2, Employee = `Test Person B`.

Click Request. Expect a success voucher number.

- [ ] **Step 2: Confirm DB rows**

```bash
psql $DATABASE_URL -c "
SELECT oi.sku, oi.qty_requested, oi.employee_name
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.id = (SELECT MAX(id) FROM orders WHERE category = 'Uniforms');"
```

Expected: two rows, each with the correct employee_name.

- [ ] **Step 3: Open admin order detail drawer, verify employee names render**

Browser → admin page → most recent uniform order → drawer should show each item with the wearer name underneath the product name.

- [ ] **Step 4: Open dispatch note, verify employee names render**

Click the dispatch-note button (or hit `/api/admin/orders/<id>/dispatch-note` directly). Expect "For: Test Person A" / "For: Test Person B" beneath each line.

- [ ] **Step 5: Verify negative case — submit Uniforms order with blank employee**

In Excel, set up Row 18 with a UNI- SKU but leave Employee blank. Click Request. Expect MsgBox; submission blocked.

- [ ] **Step 6: Verify negative case at API level (defence in depth)**

```bash
curl -s -X POST http://localhost:3000/api/excel/orders \
  -H "Content-Type: application/json" \
  -H "x-excel-api-key: $KEY" \
  -d '{
    "site_code": "HAR-001",
    "category": "Uniforms",
    "items": [{"sku":"UNI-001","quantity":1}]
  }'
```

Expected: HTTP 400 with `Item UNI-001: employee name is required for uniform orders.`

- [ ] **Step 7: Verify non-uniform regression — PPE order with no employee_name still works**

Place a PPE order via Excel (no employee column needed). Confirm it submits and the resulting `order_items.employee_name` is NULL.

- [ ] **Step 8: Clean up the temp test script**

```bash
rm scripts/test-employee-name-validation.ts
git add -u scripts/test-employee-name-validation.ts
git commit -m "chore: remove ad-hoc validation test script"
```

(Optional — keep it if Allen wants the script as a regression check.)

---

## Acceptance checklist (mirrors spec § Acceptance criteria)

- [ ] A new uniform order placed via Excel cannot be submitted without an employee name on every line.
- [ ] A uniform order placed via API cannot be persisted without an employee name on every line (HTTP 400).
- [ ] A non-uniform order is unaffected: submits without complaint, `employee_name` column stored as NULL.
- [ ] Admin order-detail drawer shows `employee_name` under each item (no regression).
- [ ] Dispatch-note PDF for a uniform order shows the employee name next to each item line.
- [ ] `excel/EXCEL_TABLE_STRUCTURE.md` accurately describes the live workbook layout.
