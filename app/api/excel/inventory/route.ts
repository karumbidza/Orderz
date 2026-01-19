import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/inventory - Get site inventory (received items)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const siteId = searchParams.get('site_id');
    const siteName = searchParams.get('site');
    const category = searchParams.get('category');
    
    let inventory;
    
    if (siteId) {
      // Get inventory for specific site by ID
      inventory = await sql`
        SELECT 
          oi.sku,
          oi.item_name,
          i.category,
          i.size,
          i.unit,
          SUM(oi.qty_requested) as total_received,
          COUNT(DISTINCT o.id) as order_count,
          MAX(o.order_date) as last_received,
          s.name as site_name,
          s.city as site_city
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN sites s ON o.site_id = s.id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE o.status = 'RECEIVED' AND o.site_id = ${parseInt(siteId)}
        GROUP BY oi.sku, oi.item_name, i.category, i.size, i.unit, s.name, s.city
        ORDER BY i.category, oi.item_name
      `;
    } else if (siteName) {
      // Get inventory for specific site by name
      inventory = await sql`
        SELECT 
          oi.sku,
          oi.item_name,
          i.category,
          i.size,
          i.unit,
          SUM(oi.qty_requested) as total_received,
          COUNT(DISTINCT o.id) as order_count,
          MAX(o.order_date) as last_received,
          s.name as site_name,
          s.city as site_city
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN sites s ON o.site_id = s.id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE o.status = 'RECEIVED' 
          AND LOWER(s.name) = LOWER(${siteName})
        GROUP BY oi.sku, oi.item_name, i.category, i.size, i.unit, s.name, s.city
        ORDER BY i.category, oi.item_name
      `;
    } else {
      // Get all inventory across all sites
      inventory = await sql`
        SELECT 
          oi.sku,
          oi.item_name,
          i.category,
          i.size,
          i.unit,
          SUM(oi.qty_requested) as total_received,
          COUNT(DISTINCT o.id) as order_count,
          MAX(o.order_date) as last_received,
          s.name as site_name,
          s.city as site_city
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        JOIN sites s ON o.site_id = s.id
        LEFT JOIN items i ON oi.item_id = i.id
        WHERE o.status = 'RECEIVED'
        GROUP BY oi.sku, oi.item_name, i.category, i.size, i.unit, s.name, s.city
        ORDER BY s.name, i.category, oi.item_name
      `;
    }
    
    // Get summary stats
    const stats = await sql`
      SELECT 
        COUNT(DISTINCT o.id) as total_orders_received,
        COUNT(DISTINCT o.site_id) as sites_count,
        COALESCE(SUM(oi.qty_requested), 0)::int as total_items_received
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status = 'RECEIVED'
    `;
    
    return Response.json({
      success: true,
      data: inventory,
      total: inventory.length,
      stats: {
        total_orders_received: stats[0]?.total_orders_received || 0,
        sites_count: stats[0]?.sites_count || 0,
        total_items_received: stats[0]?.total_items_received || 0,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error fetching inventory:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch inventory',
    }, { status: 500 });
  }
}
