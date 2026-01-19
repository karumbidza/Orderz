import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────
// GET /api/excel/item-roles - Get available roles for a product
// Used for cascading dropdown: Item → Role → Size
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product');
    const category = searchParams.get('category');
    
    if (!product) {
      return Response.json({
        success: false,
        error: 'Product is required',
      }, { status: 400 });
    }
    
    let roles;
    
    if (category) {
      roles = await sql`
        SELECT DISTINCT role
        FROM items
        WHERE is_active = true 
          AND product = ${product}
          AND category = ${category}
          AND role IS NOT NULL
        ORDER BY role
      `;
    } else {
      roles = await sql`
        SELECT DISTINCT role
        FROM items
        WHERE is_active = true 
          AND product = ${product}
          AND role IS NOT NULL
        ORDER BY role
      `;
    }
    
    const roleList = roles.map((r: any) => r.role);
    
    return Response.json({
      success: true,
      roles: roleList,
      has_roles: roleList.length > 1 || (roleList.length === 1 && roleList[0] !== 'All'),
    });
    
  } catch (error) {
    console.error('Error fetching roles:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch roles',
    }, { status: 500 });
  }
}
