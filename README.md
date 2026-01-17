# Orderz - Inventory & Ordering System

A centralized inventory and ordering system with:
- **Neon (PostgreSQL)** as the single source of truth
- **Next.js API** hosted on Vercel
- **Excel** as a lightweight frontend for order forms & admin trackers

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env.local` and update with your Neon credentials:
```bash
cp .env.example .env.local
```

### 3. Run Database Migrations
Execute the SQL files in order in your Neon SQL Editor:
1. `sql/001_schema.sql` - Tables, indexes, constraints
2. `sql/002_business_rules.sql` - Triggers, functions, views
3. `sql/003_seed_data.sql` - Sample data templates

### 4. Start Development Server
```bash
npm run dev
```

### 5. Test the API
```bash
curl http://localhost:3000/api/health
```

---

## 📁 Project Structure

```
orderz/
├── app/
│   ├── api/
│   │   ├── health/          # Health check endpoint
│   │   ├── items/           # Product catalog CRUD
│   │   ├── sites/           # Branch locations CRUD
│   │   ├── warehouses/      # Warehouse CRUD
│   │   ├── stock/           # Stock levels & movements
│   │   │   ├── check/       # Availability check
│   │   │   ├── low/         # Low stock alerts
│   │   │   ├── movements/   # Stock movement ledger
│   │   │   └── reconcile/   # Audit reconciliation
│   │   ├── orders/          # Order management
│   │   │   └── [id]/
│   │   │       ├── items/   # Order line items
│   │   │       └── fulfill/ # Order fulfillment
│   │   └── excel/           # Excel-optimized endpoints
│   │       ├── items/
│   │       ├── stock/
│   │       ├── sites/
│   │       ├── orders/
│   │       ├── lookups/
│   │       └── submit-order/
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── db.ts               # Neon database connection
│   ├── types.ts            # TypeScript interfaces
│   ├── validations.ts      # Zod schemas
│   └── api-utils.ts        # Response helpers
├── sql/
│   ├── 001_schema.sql      # Database schema
│   ├── 002_business_rules.sql  # Triggers & functions
│   └── 003_seed_data.sql   # Seed templates
└── docs/
    └── EXCEL_INTEGRATION.md
```

---

## 🔌 API Reference

### Health Check
```
GET /api/health
```
Returns system status and database connectivity.

### Items (Product Catalog)
```
GET    /api/items              # List items (paginated, filterable)
GET    /api/items/:id          # Get single item
POST   /api/items              # Create item
PUT    /api/items/:id          # Update item
DELETE /api/items/:id          # Soft delete item
GET    /api/items/categories   # List categories with counts
```

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 50, max: 500)
- `category` - Filter by category
- `search` - Search in product name/SKU
- `sort_by` - Sort column (id, sku, category, product, cost)
- `sort_order` - asc or desc

### Sites (Branches)
```
GET    /api/sites         # List sites
GET    /api/sites/:id     # Get single site
POST   /api/sites         # Create site
PUT    /api/sites/:id     # Update site
DELETE /api/sites/:id     # Soft delete site
```

### Warehouses
```
GET    /api/warehouses         # List warehouses
GET    /api/warehouses/:id     # Get single warehouse
POST   /api/warehouses         # Create warehouse
PUT    /api/warehouses/:id     # Update warehouse
DELETE /api/warehouses/:id     # Soft delete warehouse
```

### Stock Levels
```
GET  /api/stock                # Stock with details (view)
GET  /api/stock/low            # Low stock alerts
GET  /api/stock/movements      # Movement history
POST /api/stock/movements      # Record new movement ⚠️
POST /api/stock/check          # Check availability
GET  /api/stock/reconcile      # Run reconciliation
```

**⚠️ Important:** Stock levels can ONLY be modified through `/api/stock/movements`. Direct edits are not allowed.

**Movement Types:**
- `IN` - Stock received (adds stock)
- `OUT` - Stock dispatched (removes stock)
- `TRANSFER` - Between warehouses (removes from source)
- `ADJUSTMENT` - Manual correction
- `ORDER` - Order fulfillment (removes stock)
- `RETURN` - Returned stock (adds stock)

### Orders
```
GET    /api/orders              # List orders (filterable)
POST   /api/orders              # Create order (DRAFT)
GET    /api/orders/:id          # Get order with items
PUT    /api/orders/:id          # Update order status
DELETE /api/orders/:id          # Cancel order

GET    /api/orders/:id/items    # Get order items
POST   /api/orders/:id/items    # Add items to order
DELETE /api/orders/:id/items    # Clear order items

POST   /api/orders/:id/fulfill  # Fulfill order items
```

**Order Status Flow:**
```
DRAFT → PENDING → APPROVED → PROCESSING → SHIPPED → DELIVERED
          ↓          ↓           ↓
       CANCELLED  CANCELLED   CANCELLED
```

### Excel Endpoints
Optimized for Power Query consumption:
```
GET  /api/excel/items         # Flat item list
GET  /api/excel/stock         # Denormalized stock data
GET  /api/excel/sites         # Site lookup data
GET  /api/excel/orders        # Flattened order lines
GET  /api/excel/lookups       # All dropdowns in one call
POST /api/excel/submit-order  # Submit order using codes
```

**Format Options:**
- `?format=json` (default)
- `?format=csv`

---

## 🔒 Business Rules (Enforced by Database)

1. **No Negative Stock** - `stock_levels.quantity >= 0` constraint
2. **Immutable Audit Trail** - `stock_movements` has no UPDATE capability
3. **Stock Changes via Movements Only** - Trigger updates `stock_levels` automatically
4. **Referential Integrity** - Foreign keys prevent orphan records
5. **Order Validation** - Status transitions are controlled
6. **Auto-Updated Timestamps** - Triggers maintain `updated_at`

---

## 📊 Excel Integration

### Power Query (Read Data)

1. **Data** → **Get Data** → **From Web**
2. Enter URL: `https://your-app.vercel.app/api/excel/stock`
3. Transform as needed
4. **Close & Load**

### VBA (Submit Orders)

See `docs/EXCEL_INTEGRATION.md` for complete VBA examples.

### Power Query M Formula Example
```m
let
    Source = Json.Document(Web.Contents("https://your-app.vercel.app/api/excel/items")),
    ToTable = Table.FromList(Source, Splitter.SplitByNothing()),
    Expanded = Table.ExpandRecordColumn(ToTable, "Column1", 
        {"id", "sku", "category", "product", "role", "size", "variant", "unit", "cost"})
in
    Expanded
```

---

## 🚀 Deployment to Vercel

### 1. Push to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

### 2. Import to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Click **Add New Project**
3. Import your GitHub repository
4. Configure environment variables:
   - `DATABASE_URL` - Your Neon connection string
   - `API_SECRET_KEY` - Generate a secure random string

### 3. Deploy
Vercel will automatically build and deploy.

---

## 🔧 Development Commands

```bash
npm run dev       # Start dev server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## 📝 License

Private - Internal use only.
