# Orderz - AI Coding Instructions

## Architecture Overview
Excel VBA frontend → Next.js 14 API (Vercel) → Neon PostgreSQL

This is a B2B **inventory ordering system** for "Redan Coupon" with two client types:
- **Site workbooks**: Excel VBA forms that submit orders via `/api/excel/*` endpoints
- **Admin UI**: React/MUI app at `/admin` for order management, inventory, dashboard

## Key Patterns

### API Route Structure
```
/api/excel/*     - Optimized for Excel VBA (simple JSON, flat structures)
/api/admin/*     - Admin panel endpoints (auth via X-Admin-Key header)
/api/*           - General REST endpoints
```

All API routes use:
- `export const dynamic = 'force-dynamic'` - disable caching
- `sql` tagged template from `@/lib/db` for Neon queries
- `successResponse()`/`errorResponse()` from `@/lib/api-utils`
- Zod schemas from `@/lib/validations.ts` for input validation

### Database Conventions
- **Column collision**: When JOINing `orders` with `sites`, both have `status` column. Always alias: `o.status as order_status`
- **Soft deletes**: Use `is_active` boolean, never hard delete master data
- **Voucher numbers**: Generated via `voucher_sequences` table with atomic increment pattern
- **Stock movements**: All stock changes logged to `stock_movements` table with type: IN, OUT, TRANSFER, ADJUSTMENT, DAMAGE

### SQL Query Style
```typescript
// Use tagged template literals (NOT string interpolation)
const result = await sql`
  SELECT * FROM items WHERE category = ${category} AND is_active = true
`;
```

### Admin Page (`/app/admin/page.tsx`)
Single ~3300 line file with tabs: dashboard, orders, inventory, sites, reports. Uses:
- MUI DataGrid for tables
- State pattern: `orders`, `orderItems`, `inventory`, `sites` arrays with loading states
- Modal dialogs for viewing/editing orders

### Excel Integration (`/api/excel/*`)
Endpoints return flat JSON optimized for VBA parsing:
- `/api/excel/catalog` - Item catalog for order forms
- `/api/excel/submit-order` - Order submission with voucher generation  
- `/api/excel/order-view/[id]` - Printable order document (HTML)

## Common Tasks

### Adding a new API endpoint
1. Create route at `app/api/{path}/route.ts`
2. Add `export const dynamic = 'force-dynamic'`
3. Use `sql` from `@/lib/db` for queries
4. Return via `successResponse(data)` or `errorResponse(message, status)`

### Adding dashboard metrics
1. Modify `/api/admin/dashboard/route.ts` to add new query
2. Update `DashboardData` interface in `/app/admin/page.tsx`
3. Add UI component in dashboard tab section

### Database schema changes
1. Add migration to `/sql/` folder with next sequence number
2. Run in Neon SQL Editor
3. Update types in `/lib/types.ts`

## Commands
```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
git push             # Auto-deploys to Vercel
```

## Environment Variables
- `DATABASE_URL` - Neon connection string
- `API_SECRET_KEY` - API auth (X-API-Key header)
- `ADMIN_SECRET_KEY` - Admin auth (X-Admin-Key header)
- `NEXT_PUBLIC_CLERK_*` - Clerk auth config

## File Reference
- [lib/db.ts](lib/db.ts) - Neon connection and `sql` export
- [lib/api-utils.ts](lib/api-utils.ts) - Response helpers, auth validation
- [lib/types.ts](lib/types.ts) - TypeScript interfaces matching DB schema
- [lib/validations.ts](lib/validations.ts) - Zod schemas for API validation
- [sql/001_schema.sql](sql/001_schema.sql) - Core database schema
