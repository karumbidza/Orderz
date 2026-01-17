// ============================================
// DATABASE TYPES - Matches Neon Schema
// ============================================

// ─────────────────────────────────────────────
// ITEMS - Master product catalog
// ─────────────────────────────────────────────
export interface Item {
  id: number;
  sku: string;
  category: string;
  product: string;
  role: string | null;
  size: string | null;
  variant: string | null;
  unit: string;
  cost: number;
  created_at: Date;
  updated_at: Date;
}

export interface ItemCreate {
  sku: string;
  category: string;
  product: string;
  role?: string | null;
  size?: string | null;
  variant?: string | null;
  unit: string;
  cost: number;
}

// ─────────────────────────────────────────────
// SITES - Branch locations
// ─────────────────────────────────────────────
export interface Site {
  id: number;
  code: string;
  name: string;
  address: string | null;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SiteCreate {
  code: string;
  name: string;
  address?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  is_active?: boolean;
}

// ─────────────────────────────────────────────
// WAREHOUSES - Stock holding locations
// ─────────────────────────────────────────────
export interface Warehouse {
  id: number;
  code: string;
  name: string;
  location: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface WarehouseCreate {
  code: string;
  name: string;
  location?: string | null;
  is_active?: boolean;
}

// ─────────────────────────────────────────────
// STOCK LEVELS - Current inventory per warehouse
// ─────────────────────────────────────────────
export interface StockLevel {
  id: number;
  item_id: number;
  warehouse_id: number;
  quantity: number;
  min_quantity: number;
  max_quantity: number | null;
  updated_at: Date;
}

export interface StockLevelWithDetails extends StockLevel {
  item_sku: string;
  item_product: string;
  warehouse_code: string;
  warehouse_name: string;
}

// ─────────────────────────────────────────────
// STOCK MOVEMENTS - Immutable audit ledger
// ─────────────────────────────────────────────
export type MovementType = 
  | 'IN'           // Stock received
  | 'OUT'          // Stock dispatched
  | 'TRANSFER'     // Between warehouses
  | 'ADJUSTMENT'   // Manual correction
  | 'ORDER'        // Order fulfillment
  | 'RETURN';      // Returned stock

export interface StockMovement {
  id: number;
  item_id: number;
  warehouse_id: number;
  movement_type: MovementType;
  quantity: number;           // Always positive; type determines direction
  reference_type: string | null;  // 'order', 'transfer', 'adjustment'
  reference_id: number | null;    // ID of related order/transfer
  notes: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface StockMovementCreate {
  item_id: number;
  warehouse_id: number;
  movement_type: MovementType;
  quantity: number;
  reference_type?: string | null;
  reference_id?: number | null;
  notes?: string | null;
  created_by?: string | null;
}

// ─────────────────────────────────────────────
// ORDERS - Order headers
// ─────────────────────────────────────────────
export type OrderStatus = 
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'PROCESSING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED';

export interface Order {
  id: number;
  order_number: string;
  site_id: number;
  warehouse_id: number;
  status: OrderStatus;
  ordered_by: string | null;
  ordered_at: Date;
  approved_by: string | null;
  approved_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface OrderCreate {
  site_id: number;
  warehouse_id: number;
  ordered_by?: string | null;
  notes?: string | null;
}

export interface OrderWithDetails extends Order {
  site_code: string;
  site_name: string;
  warehouse_code: string;
  warehouse_name: string;
  total_items: number;
  total_quantity: number;
}

// ─────────────────────────────────────────────
// ORDER ITEMS - Line items per order
// ─────────────────────────────────────────────
export interface OrderItem {
  id: number;
  order_id: number;
  item_id: number;
  quantity_ordered: number;
  quantity_fulfilled: number;
  unit_cost: number;
  notes: string | null;
  created_at: Date;
}

export interface OrderItemCreate {
  order_id: number;
  item_id: number;
  quantity_ordered: number;
  unit_cost?: number;
  notes?: string | null;
}

export interface OrderItemWithDetails extends OrderItem {
  item_sku: string;
  item_product: string;
  item_category: string;
  available_stock: number;
}

// ─────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface StockCheckResult {
  item_id: number;
  item_sku: string;
  warehouse_id: number;
  requested: number;
  available: number;
  sufficient: boolean;
}
