import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/reorder-alerts - Get items that need reordering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const siteId = searchParams.get('site_id');
    const category = searchParams.get('category');
    
    // Get all items below reorder level
    let alerts;
    
    if (siteId && category) {
      alerts = await sql`
        SELECT s.id as site_id, s.site_code, s.name as site_name, s.city, s.fulfillment_zone,
          i.id as item_id, i.sku, i.category, i.product, i.size,
          ss.quantity_on_hand, ss.reorder_level, ss.reorder_quantity,
          ss.last_received, ss.last_issued,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.reorder_level > 0 
          AND ss.quantity_on_hand <= ss.reorder_level
          AND s.id = ${parseInt(siteId)}
          AND i.category = ${category}
        ORDER BY ss.quantity_on_hand, s.site_code, i.category, i.product
      `;
    } else if (siteId) {
      alerts = await sql`
        SELECT s.id as site_id, s.site_code, s.name as site_name, s.city, s.fulfillment_zone,
          i.id as item_id, i.sku, i.category, i.product, i.size,
          ss.quantity_on_hand, ss.reorder_level, ss.reorder_quantity,
          ss.last_received, ss.last_issued,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.reorder_level > 0 
          AND ss.quantity_on_hand <= ss.reorder_level
          AND s.id = ${parseInt(siteId)}
        ORDER BY ss.quantity_on_hand, s.site_code, i.category, i.product
      `;
    } else if (category) {
      alerts = await sql`
        SELECT s.id as site_id, s.site_code, s.name as site_name, s.city, s.fulfillment_zone,
          i.id as item_id, i.sku, i.category, i.product, i.size,
          ss.quantity_on_hand, ss.reorder_level, ss.reorder_quantity,
          ss.last_received, ss.last_issued,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.reorder_level > 0 
          AND ss.quantity_on_hand <= ss.reorder_level
          AND i.category = ${category}
        ORDER BY ss.quantity_on_hand, s.site_code, i.category, i.product
      `;
    } else {
      alerts = await sql`
        SELECT s.id as site_id, s.site_code, s.name as site_name, s.city, s.fulfillment_zone,
          i.id as item_id, i.sku, i.category, i.product, i.size,
          ss.quantity_on_hand, ss.reorder_level, ss.reorder_quantity,
          ss.last_received, ss.last_issued,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.reorder_level > 0 AND ss.quantity_on_hand <= ss.reorder_level
        ORDER BY ss.quantity_on_hand, s.site_code, i.category, i.product
      `;
    }
    
    // Summary stats
    const summary = await sql`
      SELECT 
        COUNT(*) FILTER (WHERE ss.quantity_on_hand <= 0) as out_of_stock,
        COUNT(*) FILTER (WHERE ss.quantity_on_hand > 0 AND ss.quantity_on_hand <= ss.reorder_level) as reorder_now,
        COUNT(*) FILTER (WHERE ss.quantity_on_hand > ss.reorder_level AND ss.quantity_on_hand <= ss.reorder_level * 1.5) as low_stock
      FROM site_stock ss
      WHERE ss.reorder_level > 0
    `;
    
    return apiResponse({ alerts, summary: summary[0] }, { 
      total: alerts.length 
    });
  } catch (error) {
    console.error('Error fetching reorder alerts:', error);
    return apiError('Failed to fetch reorder alerts', 500);
  }
}
