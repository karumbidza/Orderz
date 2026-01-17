import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { apiResponse, apiError, getPaginationParams } from '@/lib/api-utils';

export const dynamic = 'force-dynamic';

// GET /api/site-stock - Get stock levels at sites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { limit, offset } = getPaginationParams(searchParams);
    
    const siteId = searchParams.get('site_id');
    const category = searchParams.get('category');
    const belowReorder = searchParams.get('below_reorder') === 'true';
    
    // Build query based on filters
    let stock;
    
    if (siteId && category && belowReorder) {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.site_id = ${parseInt(siteId)} AND i.category = ${category}
          AND ss.quantity_on_hand <= ss.reorder_level AND ss.reorder_level > 0
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (siteId && category) {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.site_id = ${parseInt(siteId)} AND i.category = ${category}
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (siteId && belowReorder) {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.site_id = ${parseInt(siteId)}
          AND ss.quantity_on_hand <= ss.reorder_level AND ss.reorder_level > 0
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (siteId) {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.site_id = ${parseInt(siteId)}
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else if (belowReorder) {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        WHERE ss.quantity_on_hand <= ss.reorder_level AND ss.reorder_level > 0
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    } else {
      stock = await sql`
        SELECT ss.*, s.site_code, s.name as site_name, s.city,
          i.sku, i.product, i.category, i.size,
          CASE WHEN ss.quantity_on_hand <= 0 THEN 'OUT_OF_STOCK'
               WHEN ss.quantity_on_hand <= ss.reorder_level THEN 'REORDER_NOW'
               WHEN ss.quantity_on_hand <= ss.reorder_level * 1.5 THEN 'LOW_STOCK'
               ELSE 'OK' END as stock_status
        FROM site_stock ss
        JOIN sites s ON ss.site_id = s.id
        JOIN items i ON ss.item_id = i.id
        ORDER BY s.site_code, i.category, i.product
        LIMIT ${limit} OFFSET ${offset}
      `;
    }
    
    return apiResponse(stock);
  } catch (error) {
    console.error('Error fetching site stock:', error);
    return apiError('Failed to fetch site stock', 500);
  }
}

// POST /api/site-stock - Initialize or update site stock
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { site_id, item_id, quantity_on_hand, reorder_level, reorder_quantity } = body;
    
    if (!site_id || !item_id) {
      return apiError('site_id and item_id are required', 400);
    }
    
    const result = await sql`
      INSERT INTO site_stock (site_id, item_id, quantity_on_hand, reorder_level, reorder_quantity)
      VALUES (${site_id}, ${item_id}, ${quantity_on_hand || 0}, ${reorder_level || 0}, ${reorder_quantity || 0})
      ON CONFLICT (site_id, item_id) 
      DO UPDATE SET 
        quantity_on_hand = COALESCE(${quantity_on_hand}, site_stock.quantity_on_hand),
        reorder_level = COALESCE(${reorder_level}, site_stock.reorder_level),
        reorder_quantity = COALESCE(${reorder_quantity}, site_stock.reorder_quantity),
        updated_at = NOW()
      RETURNING *
    `;
    
    return apiResponse(result[0], undefined, 'Site stock updated');
  } catch (error) {
    console.error('Error updating site stock:', error);
    return apiError('Failed to update site stock', 500);
  }
}
