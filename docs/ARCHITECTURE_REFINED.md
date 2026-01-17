# Refined Inventory System Architecture

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            HEAD OFFICE WAREHOUSE                             │
│                         (Central Stock - All Items)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Uniforms   │  │    PPE      │  │ Stationery  │  │ Consumables │         │
│  │  (68 SKUs)  │  │  (9 SKUs)   │  │  (4 SKUs)   │  │  (3 SKUs)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘         │
│          ↓               ↓               ↓               ↓                   │
│  ┌───────────────────────────────────────────────────────────────────┐      │
│  │                      stock_levels (84 items)                       │      │
│  │                    stock_movements (audit trail)                   │      │
│  └───────────────────────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                               ORDERS FLOW DOWN
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SITE ORDER PROCESS                              │
│                                                                              │
│  1. Site places ORDER ──────────────────────────────────────────────────►   │
│     └── For UNIFORMS: Must include employee_id + employee_name              │
│     └── For ALL: qty_requested per item                                      │
│                                                                              │
│  2. Head Office APPROVES ──────────────────────────────────────────────►    │
│     └── Sets qty_approved (may differ from requested)                        │
│     └── Deducts from stock_levels (warehouse)                                │
│     └── Status: PENDING → APPROVED → DISPATCHED                              │
│                                                                              │
│  3. Site RECEIVES order ──────────────────────────────────────────────►     │
│     └── Updates site_stock (increases quantity_on_hand)                      │
│     └── Creates site_stock_movements (RECEIVED)                              │
│     └── For SERIALIZED: Links specific serial numbers                        │
│     └── Status: DISPATCHED → DELIVERED                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SITE MINI-WAREHOUSE                                │
│                        (Each of 69 sites has one)                            │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                         site_stock                                   │    │
│  │  - quantity_on_hand    (current stock)                               │    │
│  │  - reorder_level       (when to alert)                               │    │
│  │  - reorder_quantity    (suggested order qty)                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                               WHEN ITEMS USED                                │
│                                      ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    site_stock_movements                              │    │
│  │  RECEIVED  - Stock arrived from Head Office                          │    │
│  │  ISSUED    - Given to employee / used                                │    │
│  │  RETURN    - Returned by employee                                    │    │
│  │  ADJUSTMENT - Stock count correction                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

```

## Item Tracking Types

| Category    | Items | Tracking Type | What's Tracked |
|-------------|-------|---------------|----------------|
| **Uniforms** | 68 | `ASSIGNED` | Employee who received each item |
| **Stationery** | 3 | `SERIALIZED` | Individual book serial numbers (Cash Receipt, Cashier Sheet, Driveway) |
| **Stationery** | 1 | `QUANTITY` | Till Rolls (bulk count only) |
| **PPE** | 9 | `QUANTITY` | Simple quantity count |
| **Consumables** | 3 | `QUANTITY` | Simple quantity count |

---

## 1. UNIFORMS FLOW (Employee Tracking)

```
┌──────────────────────────────────────────────────────────────────────┐
│                        UNIFORM ORDER                                  │
│                                                                       │
│  Site Manager orders uniform:                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  order_items                                                    │  │
│  │  ├── item_id: UNI-SHIRT-M                                       │  │
│  │  ├── qty_requested: 2                                           │  │
│  │  ├── employee_id: 47                                            │  │
│  │  └── employee_name: "John Moyo"  ← REQUIRED                     │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              ↓                                        │
│  When received at site:                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  uniform_assignments                                            │  │
│  │  ├── employee_id: 47                                            │  │
│  │  ├── item_id: UNI-SHIRT-M                                       │  │
│  │  ├── quantity: 2                                                │  │
│  │  ├── assigned_date: 2026-01-17                                  │  │
│  │  └── status: ACTIVE                                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Query: "What uniforms does John Moyo have?"                         │
│  → SELECT * FROM v_employee_uniforms WHERE employee_name = 'John Moyo'│
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. STATIONERY FLOW (Serial Number Tracking)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    CONTROL BOOK TRACKING                              │
│                                                                       │
│  Head Office receives new receipt books from supplier:                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  serialized_inventory                                           │  │
│  │  ├── item_id: STA-CASH-REC                                      │  │
│  │  ├── serial_number: "RB-2026-0001"                              │  │
│  │  ├── start_number: 000001                                       │  │
│  │  ├── end_number: 000100                                         │  │
│  │  ├── current_location_type: WAREHOUSE                           │  │
│  │  └── status: AVAILABLE                                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              ↓                                        │
│  Sent to site in order:                                               │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  serialized_inventory (updated)                                 │  │
│  │  ├── current_location_type: SITE                                │  │
│  │  ├── site_id: 15 (Avondale)                                     │  │
│  │  ├── received_at_site: 2026-01-17                               │  │
│  │  └── status: AVAILABLE                                          │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              ↓                                        │
│  Issued to cashier:                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  serialized_inventory (updated)                                 │  │
│  │  ├── current_location_type: ISSUED                              │  │
│  │  ├── issued_to_employee_id: 23                                  │  │
│  │  ├── issued_date: 2026-01-18                                    │  │
│  │  └── status: IN_USE                                             │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Query: "Where is receipt book RB-2026-0001?"                        │
│  → SELECT * FROM v_serialized_items WHERE serial_number = 'RB-2026-0001'│
│                                                                       │
│  Query: "What books does Avondale have?"                             │
│  → SELECT * FROM v_serialized_items WHERE site_code = 'AVONDALE'     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 3. REORDER ALERTS (Consumables & Stationery)

```
┌──────────────────────────────────────────────────────────────────────┐
│                    AUTOMATIC REORDER ALERTS                           │
│                                                                       │
│  site_stock record:                                                   │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  site_id: 15 (Avondale)                                         │  │
│  │  item_id: STA-TILL-ROLL                                         │  │
│  │  quantity_on_hand: 5    ← Current stock                         │  │
│  │  reorder_level: 10      ← Alert when at or below                │  │
│  │  reorder_quantity: 50   ← Suggested order amount                │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                              ↓                                        │
│  v_reorder_alerts view shows:                                         │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │  site_code: AVONDALE                                            │  │
│  │  sku: STA-TILL-ROLL                                             │  │
│  │  quantity_on_hand: 5                                            │  │
│  │  reorder_level: 10                                              │  │
│  │  stock_status: REORDER_NOW                                      │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                       │
│  Excel pulls: SELECT * FROM v_reorder_alerts                         │
│  → Shows all items needing reorder across all sites                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Database Tables Summary

| Table | Purpose | Records |
|-------|---------|---------|
| `items` | Master item catalog | 84 |
| `sites` | Site locations | 69 |
| `warehouses` | Central warehouse(s) | 1 |
| `employees` | Employee master | *To seed* |
| `orders` | Order headers | 0 |
| `order_items` | Order line items (with employee for uniforms) | 0 |
| `stock_levels` | Warehouse stock | *To initialize* |
| `site_stock` | Site mini-warehouse stock | 0 |
| `site_stock_movements` | Site stock audit trail | 0 |
| `serialized_inventory` | Individual tracked items (receipt books) | 0 |
| `uniform_assignments` | Uniform → Employee assignments | 0 |

---

## Views (For Excel)

| View | Purpose |
|------|---------|
| `v_reorder_alerts` | Items below reorder level at each site |
| `v_employee_uniforms` | All uniforms assigned to each employee |
| `v_serialized_items` | Where is each control book |
| `v_site_stock_summary` | Stock overview by site and category |

---

## Order Status Flow

```
PENDING → APPROVED → DISPATCHED → DELIVERED
                          │
              (Harare: READY_FOR_COLLECTION)
              (Other:  IN_TRANSIT)
```

---

## Next Steps

1. **Seed employees** - Need employee list from sites
2. **Initialize warehouse stock** - Set opening quantities at HEAD-OFFICE
3. **Set reorder levels** - Define minimum stock per item/site
4. **Update API routes** - Add endpoints for new tables
5. **Create Excel templates** - Order forms with employee fields
