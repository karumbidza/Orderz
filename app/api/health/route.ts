import { NextResponse } from 'next/server';
import { checkConnection, sql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const isConnected = await checkConnection();
    
    if (!isConnected) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Database connection failed',
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }

    // Get some basic stats
    const stats = await sql`
      SELECT 
        (SELECT COUNT(*) FROM items WHERE is_active = true) as items_count,
        (SELECT COUNT(*) FROM sites WHERE is_active = true) as sites_count,
        (SELECT COUNT(*) FROM warehouses WHERE is_active = true) as warehouses_count,
        (SELECT COUNT(*) FROM orders) as orders_count
    `;

    return NextResponse.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
      stats: stats[0],
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
