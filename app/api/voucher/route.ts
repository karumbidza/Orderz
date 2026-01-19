import { NextRequest } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// ─────────────────────────────────────────────
// GET /api/voucher - Get next voucher number (preview, doesn't increment)
// ─────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefix = searchParams.get('prefix') || 'RV';
    
    const year = new Date().getFullYear();
    
    // Get current sequence without incrementing
    const result = await sql`
      SELECT last_number 
      FROM voucher_sequences 
      WHERE prefix = ${prefix} AND year = ${year}
    `;
    
    let nextNumber = 1;
    if (result.length > 0) {
      nextNumber = result[0].last_number + 1;
    }
    
    const voucherNumber = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
    
    return Response.json({
      success: true,
      data: {
        voucher_number: voucherNumber,
        prefix,
        year,
        sequence: nextNumber,
        is_preview: true,
      }
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      }
    });
    
  } catch (error) {
    console.error('Error getting voucher number:', error);
    return Response.json({
      success: false,
      error: 'Failed to get voucher number',
    }, { status: 500 });
  }
}

// ─────────────────────────────────────────────
// POST /api/voucher - Generate and reserve next voucher number
// ─────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const prefix = body.prefix || 'RV';
    
    const year = new Date().getFullYear();
    
    // Try to update existing sequence
    let result = await sql`
      UPDATE voucher_sequences 
      SET last_number = last_number + 1,
          updated_at = NOW()
      WHERE prefix = ${prefix} AND year = ${year}
      RETURNING last_number
    `;
    
    let lastNumber: number;
    
    if (result.length === 0) {
      // Create new sequence for this year
      result = await sql`
        INSERT INTO voucher_sequences (prefix, year, last_number)
        VALUES (${prefix}, ${year}, 1)
        ON CONFLICT (prefix, year) 
        DO UPDATE SET last_number = voucher_sequences.last_number + 1,
                      updated_at = NOW()
        RETURNING last_number
      `;
      lastNumber = result[0].last_number;
    } else {
      lastNumber = result[0].last_number;
    }
    
    const voucherNumber = `${prefix}-${year}-${String(lastNumber).padStart(4, '0')}`;
    
    return Response.json({
      success: true,
      data: {
        voucher_number: voucherNumber,
        prefix,
        year,
        sequence: lastNumber,
      }
    }, { status: 201 });
    
  } catch (error) {
    console.error('Error generating voucher number:', error);
    return Response.json({
      success: false,
      error: 'Failed to generate voucher number',
    }, { status: 500 });
  }
}
