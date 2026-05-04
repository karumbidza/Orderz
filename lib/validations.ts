import { z } from 'zod';

// ============================================
// ZOD VALIDATION SCHEMAS
// Used for API input validation
// ============================================

// ─────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────
export const ItemCreateSchema = z.object({
  sku: z.string().min(1).max(50),
  category_id: z.number().int().positive('Category is required'),
  product: z.string().min(1).max(255),
  role: z.string().max(100).nullable().optional(),
  size: z.string().max(50).nullable().optional(),
  variant: z.string().max(100).nullable().optional(),
  unit: z.string().min(1).max(20),
  cost: z.number().min(0),
});

export const ItemUpdateSchema = ItemCreateSchema.partial();

// ─────────────────────────────────────────────
// SITES
// ─────────────────────────────────────────────
export const SiteCreateSchema = z.object({
  site_code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(255),
  city: z.string().max(100).nullable().optional(),
  address: z.string().max(500).nullable().optional(),
  contact_name: z.string().max(255).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  fulfillment_zone: z.enum(['COLLECTION', 'DISPATCH']).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const SiteUpdateSchema = SiteCreateSchema.partial();

// ─────────────────────────────────────────────
// WAREHOUSES
// ─────────────────────────────────────────────
export const WarehouseCreateSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(255),
  location: z.string().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const WarehouseUpdateSchema = WarehouseCreateSchema.partial();

// ─────────────────────────────────────────────
// STOCK MOVEMENTS
// ─────────────────────────────────────────────
export const MovementTypeSchema = z.enum([
  'IN',
  'OUT',
  'TRANSFER',
  'ADJUSTMENT',
  'ORDER',
  'RETURN',
]);

export const StockMovementCreateSchema = z.object({
  item_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive(),
  movement_type: MovementTypeSchema,
  quantity: z.number().int().positive(), // Always positive
  reference_type: z.string().max(50).nullable().optional(),
  reference_id: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  created_by: z.string().max(255).nullable().optional(),
});

// ─────────────────────────────────────────────
// ORDERS
// ─────────────────────────────────────────────
export const OrderStatusSchema = z.enum([
  'DRAFT',
  'PENDING',
  'APPROVED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

export const OrderCreateSchema = z.object({
  site_id: z.number().int().positive(),
  warehouse_id: z.number().int().positive(),
  ordered_by: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

export const OrderUpdateSchema = z.object({
  status: OrderStatusSchema.optional(),
  approved_by: z.string().max(255).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
});

// ─────────────────────────────────────────────
// ORDER ITEMS
// ─────────────────────────────────────────────
// Note: `employee_name` here is dormant — only ExcelOrderSchema.superRefine
// (below) enforces presence. See plan 2026-05-04 Task 1b.
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
  if ((order.category ?? '').trim() === 'Uniforms') {
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

// ─────────────────────────────────────────────
// SUBMIT-ORDER PAYLOAD (POST /api/excel/submit-order)
// The endpoint the *live* workbook (vbaProject.bin) actually hits.
// Different shape from ExcelOrderSchema above: items reference item_id +
// pre-resolved sku/item_name, quantity is `quantity` (not `quantity_ordered`),
// and totals are computed client-side.
// ─────────────────────────────────────────────
export const OrderSubmitItemSchema = z.object({
  item_id:    z.number().int().positive(),
  sku:        z.string().min(1).max(50).trim(),
  item_name:  z.string().min(1).max(200).trim(),
  size:       z.string().max(100).trim().optional().nullable(),
  quantity:   z.number().int().positive().max(10_000),
  unit_cost:  z.number().min(0).max(100_000),
  line_total: z.number().min(0).max(10_000_000),
  employee_name: z.string().max(255).trim().optional().nullable(),
});

export const OrderSubmitSchema = z.object({
  site_id:      z.number().int().positive(),
  site_name:    z.string().min(1).max(100).trim(),
  category:     z.string().min(1).max(100).trim(),
  requested_by: z.string().max(100).trim().optional(),
  notes:        z.string().max(500).trim().optional(),
  total_amount: z.number().min(0).max(1_000_000),
  items: z.array(OrderSubmitItemSchema).min(1, 'At least one item is required').max(50),
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

// ─────────────────────────────────────────────
// PAGINATION & FILTERS
// ─────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1).catch(1),
  limit: z.coerce.number().int().min(1).max(500).default(100).catch(100),
  sort_by: z.string().optional().default('id'),
  sort_order: z.enum(['asc', 'desc']).optional().default('asc'),
});

export const ItemFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
});

export const StockFilterSchema = z.object({
  warehouse_id: z.coerce.number().int().positive().optional(),
  low_stock: z.coerce.boolean().optional(), // Only items below min_quantity
  category: z.string().optional(),
});

export const OrderFilterSchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  status: OrderStatusSchema.optional(),
  from_date: z.string().datetime().optional(),
  to_date: z.string().datetime().optional(),
});

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
  .refine((s) => {
    const d = new Date(`${s}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
  }, 'Invalid calendar date');

export const OrderExportFiltersSchema = z
  .object({
    status: z.array(ExportStatusSchema).optional(),
    // TODO(ORDERZ-EXPORT): tighten to z.enum once category source-of-truth is centralised.
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
    // Lex compare is safe for fixed-width YYYY-MM-DD (regex enforces).
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
        message: '`amount_max` must be greater than or equal to `amount_min`',
      });
    }
  });

export type OrderExportFilters = z.infer<typeof OrderExportFiltersSchema>;
