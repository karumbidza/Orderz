// ORDERZ-DISPATCH
// Vercel Cron Job — runs daily at 06:00 UTC
// Automatically marks DISPATCHED orders as RECEIVED once auto_receive_date has passed
import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Verify request is from Vercel Cron (CRON_SECRET header)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await sql`
      UPDATE orders
      SET
        status      = 'RECEIVED',
        received_at = NOW(),
        received_by = 'Auto-Receive System',
        updated_at  = NOW()
      WHERE status = 'DISPATCHED'
        AND auto_receive_date IS NOT NULL
        AND auto_receive_date <= CURRENT_DATE
      RETURNING id, voucher_number, auto_receive_date
    `;

    console.log(`[auto-receive] Marked ${result.length} order(s) as RECEIVED`, result.map((r: Record<string, unknown>) => r.voucher_number));

    return NextResponse.json({
      success: true,
      auto_received: result.length,
      orders: result.map((r: Record<string, unknown>) => ({
        id: r.id,
        voucher_number: r.voucher_number,
        auto_receive_date: r.auto_receive_date,
      })),
    });
  } catch (err) {
    console.error('[auto-receive] Error:', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
