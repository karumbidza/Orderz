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

// ─────────────────────────────────────────────
// EMPLOYEES - Staff at sites
// ─────────────────────────────────────────────
export interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  site_id: number | null;
  role: string | null;
  phone: string | null;
  email: string | null;
  hire_date: Date | null;
  status: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
  created_at: Date;
  updated_at: Date;
}

export interface EmployeeCreate {
  employee_code: string;
  first_name: string;
  last_name: string;
  site_id?: number | null;
  role?: string | null;
  phone?: string | null;
  email?: string | null;
  hire_date?: Date | null;
  status?: 'ACTIVE' | 'TERMINATED' | 'SUSPENDED';
}

export interface EmployeeWithSite extends Employee {
  site_code: string;
  site_name: string;
}

// ─────────────────────────────────────────────
// SITE STOCK - Mini-warehouse at each site
// ─────────────────────────────────────────────
export interface SiteStock {
  id: number;
  site_id: number;
  item_id: number;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  last_received: Date | null;
  last_issued: Date | null;
  updated_at: Date;
}

export interface SiteStockWithDetails extends SiteStock {
  site_code: string;
  site_name: string;
  item_sku: string;
  item_product: string;
  item_category: string;
  stock_status: 'OK' | 'LOW_STOCK' | 'REORDER_NOW' | 'OUT_OF_STOCK';
}

// ─────────────────────────────────────────────
// SITE STOCK MOVEMENTS - Audit trail at site level
// ─────────────────────────────────────────────
export type SiteMovementType = 'RECEIVED' | 'ISSUED' | 'ADJUSTMENT' | 'RETURN';

export interface SiteStockMovement {
  id: number;
  site_id: number;
  item_id: number;
  movement_type: SiteMovementType;
  quantity: number;
  balance_after: number | null;
  reference_type: string | null;
  reference_id: number | null;
  employee_id: number | null;
  serial_numbers: string[] | null;
  reason: string | null;
  performed_by: string | null;
  created_at: Date;
}

export interface SiteStockMovementCreate {
  site_id: number;
  item_id: number;
  movement_type: SiteMovementType;
  quantity: number;
  reference_type?: string | null;
  reference_id?: number | null;
  employee_id?: number | null;
  serial_numbers?: string[] | null;
  reason?: string | null;
  performed_by?: string | null;
}

// ─────────────────────────────────────────────
// SERIALIZED INVENTORY - Control books with serial numbers
// ─────────────────────────────────────────────
export type SerializedStatus = 'AVAILABLE' | 'ISSUED' | 'IN_USE' | 'COMPLETED' | 'VOID' | 'LOST';
export type LocationType = 'WAREHOUSE' | 'SITE' | 'ISSUED' | 'VOID';

export interface SerializedItem {
  id: number;
  item_id: number;
  serial_number: string;
  current_location_type: LocationType;
  warehouse_id: number | null;
  site_id: number | null;
  issued_to_employee_id: number | null;
  issued_date: Date | null;
  status: SerializedStatus;
  received_at_warehouse: Date;
  received_at_site: Date | null;
  start_number: number | null;
  end_number: number | null;
  current_number: number | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface SerializedItemCreate {
  item_id: number;
  serial_number: string;
  current_location_type?: LocationType;
  warehouse_id?: number | null;
  site_id?: number | null;
  start_number?: number | null;
  end_number?: number | null;
  notes?: string | null;
}

export interface SerializedItemWithDetails extends SerializedItem {
  item_sku: string;
  item_product: string;
  site_code: string | null;
  site_name: string | null;
  warehouse_name: string | null;
  employee_code: string | null;
  employee_name: string | null;
}

// ─────────────────────────────────────────────
// UNIFORM ASSIGNMENTS - Track uniforms to employees
// ─────────────────────────────────────────────
export type UniformStatus = 'ACTIVE' | 'RETURNED' | 'LOST' | 'WRITTEN_OFF';

export interface UniformAssignment {
  id: number;
  employee_id: number;
  item_id: number;
  quantity: number;
  assigned_date: Date;
  returned_date: Date | null;
  condition_on_return: string | null;
  order_id: number | null;
  site_stock_movement_id: number | null;
  status: UniformStatus;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UniformAssignmentCreate {
  employee_id: number;
  item_id: number;
  quantity?: number;
  assigned_date?: Date;
  order_id?: number | null;
  notes?: string | null;
}

export interface UniformAssignmentWithDetails extends UniformAssignment {
  employee_code: string;
  employee_name: string;
  site_code: string;
  site_name: string;
  item_sku: string;
  item_product: string;
  item_size: string | null;
}

// ─────────────────────────────────────────────
// ENHANCED ORDER ITEMS - With employee for uniforms
// ─────────────────────────────────────────────
export interface OrderItemEnhanced extends OrderItem {
  employee_id: number | null;
  employee_name: string | null;
}

export interface OrderItemCreateEnhanced extends OrderItemCreate {
  employee_id?: number | null;
  employee_name?: string | null;
}

// ─────────────────────────────────────────────
// REORDER ALERT - From view
// ─────────────────────────────────────────────
export interface ReorderAlert {
  site_id: number;
  site_code: string;
  site_name: string;
  city: string;
  fulfillment_zone: string;
  item_id: number;
  sku: string;
  category: string;
  product: string;
  size: string | null;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  last_received: Date | null;
  last_issued: Date | null;
  stock_status: 'OK' | 'LOW_STOCK' | 'REORDER_NOW' | 'OUT_OF_STOCK';
}

// ─────────────────────────────────────────────
// ITEM TRACKING TYPES
// ─────────────────────────────────────────────
export type TrackingType = 'QUANTITY' | 'SERIALIZED' | 'ASSIGNED';

export interface ItemWithTracking extends Item {
  tracking_type: TrackingType;
  is_serialized: boolean;
  requires_employee: boolean;
}
