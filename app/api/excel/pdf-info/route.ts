import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/excel/order-pdf - Get PDF info for an order
// Returns a URL that can be opened in browser
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voucherNumber = searchParams.get('voucher');
    const orderId = searchParams.get('order_id');
    
    if (!voucherNumber && !orderId) {
      return Response.json({
        success: false,
        error: 'voucher or order_id is required',
      }, { status: 400 });
    }
    
    let order;
    
    if (orderId) {
      order = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.pdf_filename,
          o.category,
          o.order_date,
          o.status,
          s.name as site_name
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        WHERE o.id = ${parseInt(orderId)}
      `;
    } else {
      order = await sql`
        SELECT 
          o.id,
          o.voucher_number,
          o.pdf_filename,
          o.category,
          o.order_date,
          o.status,
          s.name as site_name
        FROM orders o
        JOIN sites s ON o.site_id = s.id
        WHERE o.voucher_number = ${voucherNumber}
      `;
    }
    
    if (order.length === 0) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }
    
    const orderData = order[0];
    
    // PDF is stored locally on the machine that created it
    // Return info so client can decide how to handle
    return Response.json({
      success: true,
      data: {
        order_id: orderData.id,
        voucher_number: orderData.voucher_number,
        pdf_filename: orderData.pdf_filename,
        site_name: orderData.site_name,
        category: orderData.category,
        order_date: orderData.order_date,
        status: orderData.status,
        // PDF view URL - can be used to regenerate/view order details
        view_url: `/api/excel/order-view/${orderData.id}`,
        has_pdf: !!orderData.pdf_filename,
      }
    });
    
  } catch (error) {
    console.error('Error fetching PDF info:', error);
    return Response.json({
      success: false,
      error: 'Failed to fetch PDF info',
    }, { status: 500 });
  }
}
