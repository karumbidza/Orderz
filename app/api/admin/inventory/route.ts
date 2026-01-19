import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/admin/inventory - Get all items for admin
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '500');
    const category = searchParams.get('category');

    let items;
    if (category) {
      items = await sql`
        SELECT 
          id, sku, category, product, role, size, unit, cost, 
          is_active, created_at, updated_at
        FROM items
        WHERE category = ${category}
        ORDER BY category, product, role, size
        LIMIT ${limit}
      `;
    } else {
      items = await sql`
        SELECT 
          id, sku, category, product, role, size, unit, cost, 
          is_active, created_at, updated_at
        FROM items
        ORDER BY category, product, role, size
        LIMIT ${limit}
      `;
    }

    return NextResponse.json({ success: true, data: items, count: items.length });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch inventory' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// PATCH /api/admin/inventory - Update item (cost, active status)
// ─────────────────────────────────────────────
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { item_id, cost, is_active } = body;

    if (!item_id) {
      return NextResponse.json({ success: false, error: 'item_id is required' }, { status: 400 });
    }

    // Build update dynamically based on what's provided
    let result;
    
    if (cost !== undefined && is_active !== undefined) {
      result = await sql`
        UPDATE items 
        SET cost = ${cost}, is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else if (cost !== undefined) {
      result = await sql`
        UPDATE items 
        SET cost = ${cost}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else if (is_active !== undefined) {
      result = await sql`
        UPDATE items 
        SET is_active = ${is_active}, updated_at = NOW()
        WHERE id = ${item_id}
        RETURNING id, sku, product, cost, is_active
      `;
    } else {
      return NextResponse.json({ success: false, error: 'Nothing to update. Provide cost or is_active' }, { status: 400 });
    }

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Item ${result[0].sku} updated`,
      item: result[0]
    });

  } catch (error) {
    console.error('Error updating item:', error);
    return NextResponse.json({ success: false, error: 'Failed to update item' }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/admin/inventory - Add new item
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sku, category, product, role, size, unit, cost } = body;

    if (!sku || !category || !product) {
      return NextResponse.json({ 
        success: false, 
        error: 'sku, category, and product are required' 
      }, { status: 400 });
    }

    // Check if SKU already exists
    const existing = await sql`SELECT id FROM items WHERE sku = ${sku}`;
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'SKU already exists' }, { status: 400 });
    }

    const result = await sql`
      INSERT INTO items (sku, category, product, role, size, unit, cost, is_active)
      VALUES (${sku}, ${category}, ${product}, ${role || 'All'}, ${size || ''}, ${unit || 'unit'}, ${cost || 0}, true)
      RETURNING id, sku, product, category, cost
    `;

    return NextResponse.json({ 
      success: true, 
      message: `Item ${result[0].sku} created`,
      item: result[0]
    });

  } catch (error) {
    console.error('Error creating item:', error);
    return NextResponse.json({ success: false, error: 'Failed to create item' }, { status: 500 });
  }
}
