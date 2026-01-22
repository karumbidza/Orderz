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
export const OrderItemCreateSchema = z.object({
  item_id: z.number().int().positive(),
  quantity_ordered: z.number().int().positive(),
  notes: z.string().max(500).nullable().optional(),
});

export const OrderItemBatchSchema = z.object({
  order_id: z.number().int().positive(),
  items: z.array(OrderItemCreateSchema).min(1),
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
