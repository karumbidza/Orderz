import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// PATCH /api/excel/order-pdf/[id] - Update PDF filename for an order
// ─────────────────────────────────────────────
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const orderId = parseInt(id);
    
    if (isNaN(orderId)) {
      return Response.json({
        success: false,
        error: 'Invalid order ID',
      }, { status: 400 });
    }
    
    const body = await request.json();
    const pdfFilename = body.pdf_filename;
    
    if (!pdfFilename) {
      return Response.json({
        success: false,
        error: 'pdf_filename is required',
      }, { status: 400 });
    }
    
    const result = await sql`
      UPDATE orders 
      SET pdf_filename = ${pdfFilename}, updated_at = NOW()
      WHERE id = ${orderId}
      RETURNING id, voucher_number, pdf_filename
    `;
    
    if (result.length === 0) {
      return Response.json({
        success: false,
        error: 'Order not found',
      }, { status: 404 });
    }
    
    return Response.json({
      success: true,
      data: result[0],
    });
    
  } catch (error) {
    console.error('Error updating PDF filename:', error);
    return Response.json({
      success: false,
      error: 'Failed to update PDF filename',
    }, { status: 500 });
  }
}
